"""
Interaction views for REST API.
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count

from core.permissions import IsHouseholdMember
from .models import Interaction, InteractionZone
from .serializers import InteractionSerializer, InteractionDetailSerializer


class InteractionViewSet(viewsets.ModelViewSet):
    """
    Interaction CRUD with filtering by type, status, tags, zones, dates.
    """
    permission_classes = [IsHouseholdMember]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    # filterset_fields = ['type', 'status', 'project', 'created_by']  # TODO: Add 'project' after projects app
    filterset_fields = ['type', 'status', 'created_by']
    search_fields = ['subject', 'content', 'enriched_text', 'tags']
    ordering_fields = ['occurred_at', 'created_at', 'subject']
    ordering = ['-occurred_at']
    
    def get_queryset(self):
        """Filter to household with prefetch."""
        queryset = Interaction.objects.filter(
            household=self.request.household
        ).select_related('created_by').prefetch_related('zones', 'documents')  # TODO: Add 'project' after projects app
        
        # Filter by zone
        zone_id = self.request.query_params.get('zone')
        if zone_id:
            queryset = queryset.filter(zones__id=zone_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(occurred_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(occurred_at__lte=end_date)
        
        # Filter by tags
        tags = self.request.query_params.get('tags')
        if tags:
            tag_list = tags.split(',')
            queryset = queryset.filter(tags__overlap=tag_list)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return InteractionDetailSerializer
        return InteractionSerializer
    
    def perform_create(self, serializer):
        """Set household and created_by from request."""
        serializer.save(
            household=self.request.household,
            created_by=self.request.user
        )
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Group interactions by type with counts."""
        queryset = self.get_queryset()
        type_counts = {}
        
        for int_type, label in Interaction.INTERACTION_TYPES:
            count = queryset.filter(type=int_type).count()
            if count > 0:
                type_counts[int_type] = {
                    'label': label,
                    'count': count
                }
        
        return Response(type_counts)
    
    @action(detail=False, methods=['get'])
    def tasks(self, request):
        """Get todos grouped by status for kanban board."""
        queryset = self.get_queryset().filter(type='todo')
        
        tasks_by_status = {}
        for status_key, label in Interaction.STATUS_CHOICES:
            tasks = queryset.filter(status=status_key)
            tasks_by_status[status_key] = InteractionSerializer(
                tasks, many=True, context={'request': request}
            ).data
        
        return Response(tasks_by_status)
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Quick status update for todos."""
        interaction = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in dict(Interaction.STATUS_CHOICES):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        interaction.status = new_status
        interaction.save()
        
        return Response(
            InteractionSerializer(interaction, context={'request': request}).data
        )
