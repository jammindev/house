"""
Zones views - REST API for zone management.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from .models import Zone, ZoneDocument
from .serializers import ZoneSerializer, ZoneTreeSerializer, ZoneDocumentSerializer
from core.permissions import IsHouseholdMember, resolve_request_household
from documents.models import Document


class ZoneViewSet(viewsets.ModelViewSet):
    """
    ViewSet for zone CRUD operations.
    
    List: Returns zones for user's households (flat or tree)
    Create: Creates new zone
    Retrieve: Gets zone details
    Update: Updates zone
    Delete: Deletes zone (cascades to children)
    """
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = ZoneSerializer

    def get_queryset(self):
        """Return zones from user's households."""
        return Zone.objects.for_user_households(self.request.user).select_related(
            'parent', 'household', 'created_by', 'updated_by'
        ).prefetch_related('children')

    def get_serializer_class(self):
        """Use tree serializer for tree action."""
        if self.action == 'tree':
            return ZoneTreeSerializer
        return ZoneSerializer

    def perform_create(self, serializer):
        """Set household and created_by from request."""
        household = resolve_request_household(self.request, required=True)
        if not household:
            raise ValidationError({'household_id': 'A valid household_id is required.'})

        serializer.save(
            household=household,
            created_by=self.request.user
        )

    def perform_update(self, serializer):
        """Set updated_by from request."""
        serializer.save(updated_by=self.request.user)

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
        """Reject stale writes when last_known_updated_at is provided."""
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Block deletion when zone still has children."""
        zone = self.get_object()
        if zone.children.exists():
            return Response(
                {'detail': 'Cannot delete zone with children. Move or delete child zones first.'},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

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
        zone_documents = ZoneDocument.objects.filter(zone=zone).select_related('document')
        serializer = ZoneDocumentSerializer(zone_documents, many=True)
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

        # Create zone document link
        zone_doc = ZoneDocument.objects.create(
            zone=zone,
            document=document,
            role='photo',
            note=note,
            created_by=request.user
        )

        serializer = ZoneDocumentSerializer(zone_doc)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
