"""
Document views for REST API.
"""
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsHouseholdMember
from .models import Document
from .serializers import DocumentSerializer, DocumentDetailSerializer


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
        """Filter to household from request context."""
        return Document.objects.filter(
            household=self.request.household
        ).select_related('created_by', 'interaction')
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DocumentDetailSerializer
        return DocumentSerializer
    
    def perform_create(self, serializer):
        """Set household and created_by from request."""
        serializer.save(
            household=self.request.household,
            created_by=self.request.user
        )
    
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
        })
