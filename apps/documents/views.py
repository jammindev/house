"""Document views for REST API."""
import logging
import uuid
from pathlib import Path

from django.contrib.contenttypes.models import ContentType
from django.core.files.storage import default_storage
from django.db import models as db_models, transaction
from django.db.models import Prefetch
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsHouseholdMember
from core.file_validation import validate_upload, ALLOWED_DOCUMENT_TYPES, DOCUMENT_MAX_SIZE
from .extraction import extract_text
from .exif import read_taken_at
from .image_processing import normalize_image
from .models import Document, DocumentLink
from .serializers import (
    DocumentSerializer,
    DocumentDetailSerializer,
    DocumentUploadSerializer,
)
from .thumbnails import generate_thumbnails
from .services import link_document
from interactions.models import Interaction
from zones.models import Zone

logger = logging.getLogger(__name__)


def _run_extraction(document: Document, *, feature: str = "ocr_upload", user=None) -> None:
    """Extract text and persist it on the document, fail-soft."""
    try:
        text, method = extract_text(document, feature=feature, user=user)
    except Exception as exc:
        logger.warning("extract_text raised for document %s: %s", document.pk, exc)
        text, method = "", "skipped"

    document.ocr_text = text or ""
    metadata = dict(document.metadata or {})
    metadata["ocr_extracted_at"] = timezone.now().isoformat()
    metadata["ocr_method"] = method
    document.metadata = metadata
    document.save(update_fields=["ocr_text", "metadata", "updated_at"])


def get_documents_queryset_for_request(request):
    query_params = getattr(request, 'query_params', request.GET)
    queryset = Document.objects.filter(
        household_id__in=request.user.householdmember_set.values_list('household_id', flat=True)
    ).filter(
        db_models.Q(is_private=False) | db_models.Q(created_by=request.user)
    ).select_related(
        'created_by',
        'interaction',
    ).prefetch_related(
        Prefetch(
            'links',
            # `entity` est une `GenericForeignKey` : sans ce prefetch imbriqué, chaque
            # lien tire sa cible à part. La liste n'étant pas paginée, sérialiser
            # `zone_links` coûterait alors une requête par lien — cinq cents pour une
            # galerie de cinq cents photos rangées.
            queryset=DocumentLink.objects.select_related('content_type')
            .prefetch_related('entity')
            .order_by('-created_at'),
            to_attr='prefetched_links',
        ),
    )

    selected_household = request.household
    if selected_household:
        queryset = queryset.filter(household=selected_household)

    # All entity links now live in the polymorphic DocumentLink table.
    interaction_ct = ContentType.objects.get_for_model(Interaction)

    qualification_state = (query_params.get('qualification_state') or '').strip()
    without_activity = (query_params.get('without_activity') or '').strip().lower()
    if qualification_state == 'without_activity' or without_activity in {'1', 'true', 'yes'}:
        # No linked interaction = not qualified by an activity.
        queryset = queryset.exclude(links__content_type=interaction_ct)

    # Photos non rangées : aucun lien vers une zone. C'est le pendant en lecture de
    # la pastille « Sans zone » de la galerie — le front ne le déduit pas d'un champ
    # local, sinon filtrer et signaler pourraient se contredire.
    without_zone = (query_params.get('without_zone') or '').strip().lower()
    if without_zone in {'1', 'true', 'yes'}:
        zone_ct = ContentType.objects.get_for_model(Zone)
        queryset = queryset.exclude(links__content_type=zone_ct)

    # Legacy per-entity params (?zone= / ?project= / ?equipment=) + generic
    # ?linked_to=<entity_type>:<uuid> all resolve to a DocumentLink filter.
    from agent import searchables

    entity_filters = []
    for param in ('zone', 'project', 'equipment', 'task', 'chicken'):
        value = (query_params.get(param) or '').strip()
        if value:
            entity_filters.append((param, value))
    linked_to = (query_params.get('linked_to') or '').strip()
    if linked_to and ':' in linked_to:
        etype, _, oid = linked_to.partition(':')
        if etype.strip() and oid.strip():
            entity_filters.append((etype.strip(), oid.strip()))

    for entity_type, object_id in entity_filters:
        spec = searchables.find_spec(entity_type)
        if spec is None:
            continue
        ct = ContentType.objects.get_for_model(spec.model)
        queryset = queryset.filter(links__content_type=ct, links__object_id=object_id)

    return queryset.distinct()


def get_recent_interaction_candidates(request, household, *, document_id=None, limit=5):
    if household is None:
        return []

    queryset = Interaction.objects.for_user_households(request.user).filter(household=household)
    if document_id:
        # Exclude interactions already linked to this document (via DocumentLink).
        queryset = queryset.exclude(document_links__document_id=document_id)
    queryset = queryset.order_by('-occurred_at')[:limit]
    return [
        {
            'id': str(item.id),
            'subject': item.subject,
            'type': item.type,
            'occurred_at': item.occurred_at,
        }
        for item in queryset
    ]


class DocumentViewSet(viewsets.ModelViewSet):
    """
    Document CRUD with filtering by type, interaction, and search.
    """
    permission_classes = [IsHouseholdMember]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'interaction', 'created_by']
    search_fields = ['name', 'notes', 'ocr_text']
    ordering_fields = ['created_at', 'name', 'type', 'taken_at', 'effective_date']
    ordering = ['-created_at']

    def get_queryset(self):
        """Filter documents to households where current user is a member.

        Annote `effective_date` = `COALESCE(taken_at, created_at)` : la date de prise
        de vue quand on la connaît, celle d'ajout sinon. C'est l'ordre que veut une
        galerie, et il doit se calculer **en SQL** — trier en Python obligerait à
        charger tout le foyer pour afficher une page.

        L'annotation ne remplace pas `taken_at` dans le payload : le front doit pouvoir
        dire « prise le » plutôt que « ajoutée le », donc il lui faut savoir laquelle
        des deux valeurs a servi.
        """
        return get_documents_queryset_for_request(self.request).annotate(
            effective_date=Coalesce('taken_at', 'created_at'),
        )
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DocumentDetailSerializer
        return DocumentSerializer

    def perform_update(self, serializer):
        """Only the document owner can toggle is_private."""
        if 'is_private' in serializer.validated_data:
            document = self.get_object()
            if document.created_by != self.request.user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only the document owner can change its privacy.")
        serializer.save()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # When the list is scoped to one linked entity, expose which entity so the
        # serializer can surface each document's phase for that context.
        qp = getattr(self.request, 'query_params', self.request.GET)
        entity_id = ''
        for param in ('zone', 'project', 'equipment'):
            entity_id = (qp.get(param) or '').strip()
            if entity_id:
                break
        if not entity_id:
            linked_to = (qp.get('linked_to') or '').strip()
            if ':' in linked_to:
                entity_id = linked_to.split(':', 1)[1].strip()
        if entity_id:
            context['link_entity_id'] = entity_id
        if self.action == 'retrieve':
            document = getattr(self, '_cached_document', None)
            if document is None:
                document = self.get_object()
                self._cached_document = document
            context['recent_interaction_candidates'] = get_recent_interaction_candidates(
                self.request,
                document.household,
                document_id=document.id,
            )
        return context

    def get_object(self):
        if hasattr(self, '_cached_document'):
            return self._cached_document
        self._cached_document = super().get_object()
        return self._cached_document
    
    def perform_create(self, serializer):
        """Set household and created_by with household consistency checks."""
        selected_household = self.request.household
        interaction_id = self.request.data.get('interaction')
        interaction = None

        if interaction_id:
            interaction = Interaction.objects.for_user_households(self.request.user).filter(id=interaction_id).first()
            if not interaction:
                raise ValidationError({'interaction': 'Invalid interaction or access denied.'})

        if selected_household and interaction and interaction.household_id != selected_household.id:
            raise ValidationError({'household_id': 'Selected household does not match interaction household.'})

        household = selected_household or (interaction.household if interaction else None)
        if household is None:
            raise ValidationError({'household_id': 'A valid household context is required.'})

        serializer.save(
            household=household,
            interaction=interaction,
            created_by=self.request.user,
        )

    @action(
        detail=False,
        methods=['post'],
        url_path='upload',
        url_name='upload',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        household = request.household
        if household is None:
            raise ValidationError({'household_id': 'A valid household context is required.'})

        uploaded_file = serializer.validated_data['file']
        detected_mime = validate_upload(
            uploaded_file,
            allowed_types=ALLOWED_DOCUMENT_TYPES,
            max_size=DOCUMENT_MAX_SIZE,
            field_name='file',
        )

        zone = None
        zone_id = serializer.validated_data.get('zone')
        if zone_id:
            zone = Zone.objects.filter(id=zone_id, household=household).first()
            if zone is None:
                raise ValidationError({'zone': 'Invalid zone or access denied.'})

        original_name = Path(uploaded_file.name).name or 'Document'

        # AVANT `normalize_image`, qui ré-encode sans transmettre l'EXIF et détruit donc
        # la date de prise de vue — pour tout HEIC/HEIF et pour tout ce qui dépasse
        # `MAX_DIMENSION`, soit l'essentiel des photos réelles. Inverser ces deux lignes
        # rendrait `taken_at` vide sans qu'aucun test d'upload ne s'en aperçoive.
        taken_at = read_taken_at(uploaded_file, household=household)

        try:
            normalized_file, final_mime, normalize_info = normalize_image(uploaded_file, detected_mime)
        except Exception as exc:
            logger.warning("normalize_image failed for %s: %s", original_name, exc)
            normalized_file, final_mime, normalize_info = uploaded_file, detected_mime, {}

        storage_filename = getattr(normalized_file, 'name', uploaded_file.name) or uploaded_file.name
        storage_path = Document.build_upload_path(
            household_id=household.id,
            filename=storage_filename,
        )
        saved_path = default_storage.save(storage_path, normalized_file)
        stored_size = default_storage.size(saved_path) if default_storage.exists(saved_path) else uploaded_file.size

        try:
            with transaction.atomic():
                metadata = {
                    'size': stored_size,
                    'original_filename': original_name,
                }
                if normalize_info.get('transcoded'):
                    metadata['original_mime_type'] = normalize_info.get('original_mime_type')
                    metadata['normalized'] = True
                if normalize_info.get('resized'):
                    metadata['resized'] = True
                if normalize_info.get('final_dimensions'):
                    metadata['dimensions'] = normalize_info['final_dimensions']

                doc_type = serializer.validated_data.get('type') or 'document'
                document = Document.objects.create(
                    household=household,
                    created_by=request.user,
                    file_path=saved_path,
                    name=(serializer.validated_data.get('name') or original_name)[:255],
                    mime_type=final_mime,
                    type=doc_type,
                    is_private=serializer.validated_data.get('is_private', False),
                    notes=serializer.validated_data.get('notes', ''),
                    metadata=metadata,
                    taken_at=taken_at,
                )
                if zone is not None:
                    link_document(
                        entity=zone,
                        document=document,
                        role='photo' if doc_type == 'photo' else 'document',
                        user=request.user,
                    )
        except Exception:
            if default_storage.exists(saved_path):
                default_storage.delete(saved_path)
            raise

        if document.type == 'photo':
            generate_thumbnails(document)
        else:
            _run_extraction(document, feature="ocr_upload", user=request.user)

        recent_candidates = get_recent_interaction_candidates(request, household)
        response_payload = {
            'document': DocumentDetailSerializer(
                document,
                context={
                    'request': request,
                    'recent_interaction_candidates': recent_candidates,
                },
            ).data,
            'detail_url': f'/app/documents/{document.id}/',
        }

        return Response(response_payload, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Group documents by type with counts."""
        queryset = self.get_queryset()
        type_counts = {}
        
        for doc_type, label in Document.DOCUMENT_TYPES:
            count = queryset.filter(type=doc_type).count()
            if count > 0:
                type_counts[doc_type] = {
                    'label': label,
                    'count': count
                }
        
        return Response(type_counts)
    
    @action(detail=True, methods=['post'], url_path='set_zones')
    def set_zones(self, request, pk=None):
        """Remplace les zones d'un document : `{"zone_ids": [...]}`.

        Un seul appel, et non `detach(ancienne)` + `attach(nouvelle)` enchaînés par le
        client : ranger une photo passerait par un état intermédiaire sans zone, et le
        client devrait connaître les anciens liens pour les défaire.

        Une liste vide **efface** les zones — c'est un geste explicite, jamais l'effet
        de bord d'un enregistrement.
        """
        document = self.get_object()

        raw = request.data.get('zone_ids', None)
        if raw is None:
            raise ValidationError({'zone_ids': 'zone_ids is required.'})
        if isinstance(raw, str) or not isinstance(raw, (list, tuple)):
            raise ValidationError({'zone_ids': 'zone_ids must be a list.'})

        # Un id malformé est une erreur du client, pas un 500 : passé tel quel à
        # `id__in` sur un UUIDField, il lèverait un `ValidationError` Django.
        requested = []
        for value in raw:
            text = str(value).strip()
            if not text:
                continue
            try:
                requested.append(uuid.UUID(text))
            except (ValueError, AttributeError, TypeError):
                raise ValidationError({'zone_ids': f'Invalid zone id: {text}'})
        requested = list(dict.fromkeys(requested))

        zones = list(Zone.objects.filter(id__in=requested, household_id=document.household_id))
        if len(zones) != len(requested):
            raise ValidationError({'zone_ids': 'Invalid zone or access denied.'})

        zone_ct = ContentType.objects.get_for_model(Zone)
        with transaction.atomic():
            existing = set(
                DocumentLink.objects.filter(
                    document=document, content_type=zone_ct
                ).values_list('object_id', flat=True)
            )
            DocumentLink.objects.filter(document=document, content_type=zone_ct).exclude(
                object_id__in=[zone.id for zone in zones]
            ).delete()
            # Ne relier que ce qui manque : `link_document` est un upsert qui remet
            # `role`/`note`/`phase` à leur défaut, donc ré-enregistrer une zone déjà
            # liée effacerait en silence le contexte porté par son lien.
            for zone in zones:
                if zone.id not in existing:
                    link_document(entity=zone, document=document, user=request.user)

        document = self.get_queryset().get(pk=document.pk)
        serializer = DocumentSerializer(document, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reprocess_ocr(self, request, pk=None):
        """Re-run text extraction on this document and persist the result."""
        document = self.get_object()
        _run_extraction(document, feature="ocr_upload", user=request.user)
        document.refresh_from_db()
        serializer = DocumentDetailSerializer(
            document,
            context={
                'request': request,
                'recent_interaction_candidates': get_recent_interaction_candidates(
                    request,
                    document.household,
                    document_id=document.id,
                ),
            },
        )
        return Response(serializer.data, status=status.HTTP_200_OK)
