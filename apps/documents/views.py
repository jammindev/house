"""Document views for REST API."""
from pathlib import Path

from django.core.files.storage import default_storage
from django.db import models as db_models, transaction
from django.db.models import Prefetch
from rest_framework import status
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsHouseholdMember
from core.file_validation import validate_upload, ALLOWED_DOCUMENT_TYPES, DOCUMENT_MAX_SIZE
from .models import Document
from .serializers import (
    DocumentSerializer,
    DocumentDetailSerializer,
    DocumentUploadSerializer,
)
from .thumbnails import generate_thumbnails
from interactions.models import Interaction
from interactions.models import InteractionDocument
from projects.models import ProjectDocument
from zones.models import ZoneDocument


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
            'interaction_documents',
            queryset=InteractionDocument.objects.select_related('interaction').order_by('-created_at'),
            to_attr='prefetched_interaction_documents',
        ),
        Prefetch(
            'zonedocument_set',
            queryset=ZoneDocument.objects.select_related('zone').order_by('-created_at'),
            to_attr='prefetched_zone_documents',
        ),
        Prefetch(
            'project_documents',
            queryset=ProjectDocument.objects.select_related('project').order_by('-created_at'),
            to_attr='prefetched_project_documents',
        ),
    )

    selected_household = request.household
    if selected_household:
        queryset = queryset.filter(household=selected_household)

    qualification_state = (query_params.get('qualification_state') or '').strip()
    without_activity = (query_params.get('without_activity') or '').strip().lower()
    if qualification_state == 'without_activity' or without_activity in {'1', 'true', 'yes'}:
        queryset = queryset.filter(interaction_documents__isnull=True)

    zone_id = (query_params.get('zone') or '').strip()
    if zone_id:
        queryset = queryset.filter(zonedocument__zone_id=zone_id)

    project_id = (query_params.get('project') or '').strip()
    if project_id:
        queryset = queryset.filter(project_documents__project_id=project_id)

    return queryset.distinct()


def get_recent_interaction_candidates(request, household, *, document_id=None, limit=5):
    if household is None:
        return []

    queryset = Interaction.objects.for_user_households(request.user).filter(household=household)
    if document_id:
        queryset = queryset.exclude(interaction_documents__document_id=document_id)
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
    ordering_fields = ['created_at', 'name', 'type']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter documents to households where current user is a member."""
        return get_documents_queryset_for_request(self.request)
    
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
        storage_path = Document.build_upload_path(
            household_id=household.id,
            filename=uploaded_file.name,
        )
        saved_path = default_storage.save(storage_path, uploaded_file)

        try:
            with transaction.atomic():
                document = Document.objects.create(
                    household=household,
                    created_by=request.user,
                    file_path=saved_path,
                    name=(serializer.validated_data.get('name') or Path(uploaded_file.name).name or 'Document')[:255],
                    mime_type=detected_mime,
                    type=serializer.validated_data.get('type') or 'document',
                    is_private=serializer.validated_data.get('is_private', False),
                    notes=serializer.validated_data.get('notes', ''),
                    metadata={
                        'size': uploaded_file.size,
                    },
                )
        except Exception:
            if default_storage.exists(saved_path):
                default_storage.delete(saved_path)
            raise

        if document.type == 'photo':
            generate_thumbnails(document)

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
    
    @action(detail=True, methods=['post'])
    def reprocess_ocr(self, request, pk=None):
        """Trigger OCR reprocessing (placeholder)."""
        document = self.get_object()
        # TODO: Queue OCR task
        return Response({
            'message': 'OCR reprocessing queued',
            'document_id': document.id
        }, status=status.HTTP_202_ACCEPTED)
