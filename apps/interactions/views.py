"""
Interaction views for REST API.
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count

from core.permissions import IsHouseholdMember, resolve_request_household
from zones.models import Zone
from .models import Interaction, InteractionZone, InteractionContact, InteractionStructure, InteractionDocument
from .serializers import (
    InteractionSerializer,
    InteractionDetailSerializer,
    InteractionContactSerializer,
    InteractionStructureSerializer,
    InteractionDocumentSerializer,
)


class InteractionViewSet(viewsets.ModelViewSet):
    """
    Interaction CRUD with filtering by type, status, tags, zones, dates.
    """
    permission_classes = [IsHouseholdMember]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'status', 'is_private', 'project', 'created_by']
    search_fields = ['subject', 'content', 'enriched_text', 'tags__tag__name']
    ordering_fields = ['occurred_at', 'created_at', 'subject']
    ordering = ['-occurred_at']

    class Pagination(LimitOffsetPagination):
        default_limit = 8
        max_limit = 100

    pagination_class = Pagination
    
    def get_queryset(self):
        """Filter interactions to households where current user is a member."""
        queryset = Interaction.objects.for_user_households(self.request.user).select_related(
            'created_by'
        ).prefetch_related('zones', 'documents', 'project')

        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        
        # Filter by zone
        zone_id = self.request.query_params.get('zone')
        if zone_id:
            queryset = queryset.filter(zones__id=zone_id)

        # Filter by contact
        contact_id = self.request.query_params.get('contact')
        if contact_id:
            queryset = queryset.filter(interaction_contacts__contact_id=contact_id)

        # Filter by structure
        structure_id = self.request.query_params.get('structure')
        if structure_id:
            queryset = queryset.filter(interaction_structures__structure_id=structure_id)

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
            queryset = queryset.filter(tags__tag__name__in=tag_list).distinct()
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return InteractionDetailSerializer
        return InteractionSerializer
    
    def perform_create(self, serializer):
        """Set household and created_by with legacy RLS-style validation."""
        zone_ids = self.request.data.get('zone_ids') or []
        if not isinstance(zone_ids, list) or not zone_ids:
            raise ValidationError({'zone_ids': 'At least one zone is required.'})

        zones = list(
            Zone.objects.for_user_households(self.request.user).filter(id__in=zone_ids)
        )

        if len(zones) != len(zone_ids):
            raise ValidationError({'zone_ids': 'One or more zones are invalid or inaccessible.'})

        household_ids = {str(zone.household_id) for zone in zones}
        if len(household_ids) != 1:
            raise ValidationError({'zone_ids': 'All zones must belong to the same household.'})

        zone_household_id = next(iter(household_ids))
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household and str(selected_household.id) != zone_household_id:
            raise ValidationError({'household_id': 'Selected household does not match provided zones.'})

        serializer.save(
            household_id=zone_household_id,
            created_by=self.request.user,
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


class _InteractionLinkBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsHouseholdMember]

    def get_queryset(self):
        queryset = self.model.objects.filter(
            interaction__household_id__in=self.request.user.householdmember_set.values_list('household_id', flat=True)
        )
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(interaction__household=selected_household)
        return queryset

    def perform_create(self, serializer):
        interaction = serializer.validated_data.get('interaction')
        if not Interaction.objects.for_user_households(self.request.user).filter(id=interaction.id).exists():
            raise ValidationError({'interaction': 'Invalid interaction or access denied.'})
        serializer.save()


class InteractionContactViewSet(_InteractionLinkBaseViewSet):
    model = InteractionContact
    serializer_class = InteractionContactSerializer


class InteractionStructureViewSet(_InteractionLinkBaseViewSet):
    model = InteractionStructure
    serializer_class = InteractionStructureSerializer


class InteractionDocumentViewSet(_InteractionLinkBaseViewSet):
    model = InteractionDocument
    serializer_class = InteractionDocumentSerializer
