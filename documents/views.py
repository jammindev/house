"""
Document views for REST API.
"""
from rest_framework import status
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsHouseholdMember, resolve_request_household
from .models import Document
from .serializers import DocumentSerializer, DocumentDetailSerializer
from interactions.models import Interaction


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
        queryset = Document.objects.filter(
            household_id__in=self.request.user.householdmember_set.values_list('household_id', flat=True)
        ).select_related('created_by', 'interaction')

        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(household=selected_household)

        return queryset
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DocumentDetailSerializer
        return DocumentSerializer
    
    def perform_create(self, serializer):
        """Set household and created_by with household consistency checks."""
        selected_household = resolve_request_household(self.request, required=False)
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
