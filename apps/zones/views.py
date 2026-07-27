"""
Zones views - REST API for zone management.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from django.contrib.contenttypes.models import ContentType

from .models import Zone
from .queries import with_content_counts
from .serializers import ZoneSerializer, ZoneTreeSerializer, ZoneDocumentSerializer
from .services import (
    move_zone,
    place_at_end,
    reorder_siblings,
    shift_positions_after_removal,
)
from core.permissions import IsHouseholdMember
from documents.models import Document, DocumentLink
from documents.mixins import DocumentLinkActionsMixin
from documents.services import link_document


class ZoneViewSet(DocumentLinkActionsMixin, viewsets.ModelViewSet):
    """
    ViewSet for zone CRUD operations.

    List: Returns zones for user's households (flat or tree)
    Create: Creates new zone
    Retrieve: Gets zone details
    Update: Updates zone
    Delete: Deletes zone (cascades to children)
    """
    document_link_role = 'document'
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = ZoneSerializer

    def get_queryset(self):
        """Return zones from user's households, annotées de leurs compteurs.

        L'annotation est posée ici — pas seulement sur l'action `list` — pour que
        détail, `children` et `tree` répondent la même chose que la liste.
        """
        return with_content_counts(
            Zone.objects.for_user_households(self.request.user).select_related(
                'parent', 'household', 'created_by', 'updated_by'
            )
        )

    def get_serializer_class(self):
        """Use tree serializer for tree action."""
        if self.action == 'tree':
            return ZoneTreeSerializer
        return ZoneSerializer

    def perform_create(self, serializer):
        """Set household and created_by from request."""
        household = self.request.household
        if not household:
            raise ValidationError({'household_id': 'A valid household_id is required.'})

        zone = serializer.save(
            household=household,
            created_by=self.request.user
        )
        # Une nouvelle zone se range en fin de fratrie : le défaut `0` du champ
        # la placerait devant des zones ordonnées de longue date.
        place_at_end(zone)

    def perform_update(self, serializer):
        """Set updated_by from request, en replaçant la zone si elle a changé de parent."""
        previous_parent_id = serializer.instance.parent_id
        previous_position = serializer.instance.position
        zone = serializer.save(updated_by=self.request.user)

        if zone.parent_id != previous_parent_id:
            # Changement de parent : la zone prend le dernier rang de sa nouvelle
            # fratrie, et l'ancienne referme le trou qu'elle laisse.
            place_at_end(zone)
            shift_positions_after_removal(
                zone.household_id, previous_parent_id, previous_position
            )

    def update(self, request, *args, **kwargs):
        """Reject stale writes when last_known_updated_at is provided."""
        zone = self.get_object()
        last_known = request.data.get('last_known_updated_at')
        if last_known:
            parsed = parse_datetime(str(last_known))
            if parsed is None:
                return Response(
                    {'detail': 'Invalid last_known_updated_at timestamp.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed, timezone=timezone.utc)
            if zone.updated_at and parsed < zone.updated_at:
                return Response(
                    {'detail': 'Conflict: zone has changed. Reload and retry.'},
                    status=status.HTTP_409_CONFLICT,
                )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Reject stale writes when last_known_updated_at is provided.

        ``partial=True`` doit être réinjecté : router vers ``update()`` sans lui
        faisait valider tout PATCH comme un PUT complet, donc un PATCH d'un seul
        champ (``{"surface": "24.75"}``) repartait en 400 pour ``name`` manquant.
        """
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Block deletion when zone still has children."""
        zone = self.get_object()
        if zone.children.exists():
            return Response(
                {'detail': 'Cannot delete zone with children. Move or delete child zones first.'},
                status=status.HTTP_409_CONFLICT,
            )
        household_id, parent_id, position = zone.household_id, zone.parent_id, zone.position
        response = super().destroy(request, *args, **kwargs)
        # Referme le trou : sans ça les rangs d'une fratrie se creusent au fil des
        # suppressions, et un « Descendre » finit par ne plus rien déplacer.
        shift_positions_after_removal(household_id, parent_id, position)
        return response

    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        """Décale la zone d'un rang parmi ses frères (`{"direction": "up"|"down"}`).

        Sert le menu contextuel de la liste. Être déjà en butée n'est pas une
        erreur — la réponse porte `moved: false` et le client n'a rien à deviner.
        """
        zone = self.get_object()
        try:
            moved = move_zone(zone, request.data.get('direction'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        zone.refresh_from_db()
        return Response({'moved': moved, 'position': zone.position})

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Applique un ordre explicite à une fratrie (glisser-déposer).

        Corps : `{"parent": "<uuid>|null", "zone_ids": [...]}` — la liste doit
        couvrir toute la fratrie, le service refuse un sous-ensemble.
        """
        household = request.household
        if not household:
            return Response(
                {'detail': 'A valid household_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        zone_ids = request.data.get('zone_ids')
        if not isinstance(zone_ids, list) or not zone_ids:
            return Response(
                {'detail': 'zone_ids must be a non-empty list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parent_id = request.data.get('parent') or None
        # Le parent doit appartenir au foyer courant, sinon un client réordonnerait
        # une fratrie qu'il ne peut pas voir. Un uuid malformé fait lever Django
        # au filtre — 400, pas 500.
        if parent_id is not None:
            try:
                parent_exists = Zone.objects.filter(pk=parent_id, household=household).exists()
            except (DjangoValidationError, ValueError):
                return Response(
                    {'detail': 'Invalid parent id.'}, status=status.HTTP_400_BAD_REQUEST
                )
            if not parent_exists:
                return Response(
                    {'detail': 'Parent zone not found in this household.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        try:
            reorder_siblings(household, parent_id, zone_ids)
        except (ValueError, DjangoValidationError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        siblings = self.get_queryset().filter(household=household, parent_id=parent_id)
        return Response(self.get_serializer(siblings, many=True).data)

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """
        Get zones as hierarchical tree.
        Returns only root zones with nested children.
        """
        household_id = request.query_params.get('household_id')
        if not household_id:
            return Response(
                {"detail": "household_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get root zones (no parent) for household
        root_zones = self.get_queryset().filter(
            household_id=household_id,
            parent__isnull=True
        )

        serializer = ZoneTreeSerializer(root_zones, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        """Get direct children of a zone."""
        zone = self.get_object()
        children = zone.children.all()
        serializer = self.get_serializer(children, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def photos(self, request, pk=None):
        """Get photos linked to this zone."""
        zone = self.get_object()
        ct = ContentType.objects.get_for_model(Zone)
        links = DocumentLink.objects.filter(
            content_type=ct, object_id=zone.id
        ).select_related('document', 'content_type').order_by('-created_at')
        serializer = ZoneDocumentSerializer(links, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def attach_photo(self, request, pk=None):
        """Attach a photo document to this zone."""
        zone = self.get_object()

        document_id = request.data.get('document_id')
        note = request.data.get('note', '')

        if not document_id:
            return Response(
                {"detail": "document_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        document = Document.objects.filter(id=document_id, household_id=zone.household_id).first()
        if not document:
            return Response(
                {"detail": "Document not found in this household."},
                status=status.HTTP_404_NOT_FOUND,
            )

        link, _created = link_document(
            entity=zone, document=document, role='photo', note=note, user=request.user
        )
        serializer = ZoneDocumentSerializer(link)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
