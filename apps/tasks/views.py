"""
Task REST API views.
"""
from django.utils import timezone
from rest_framework import viewsets, filters
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.pagination import LimitOffsetPagination
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsHouseholdMember
from zones.models import Zone
from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    """
    Task CRUD with filtering by status, priority, zone, assigned_to, overdue.
    completed_by and completed_at are auto-managed on status transitions.
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = TaskSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_to', 'project', 'is_private']
    search_fields = ['subject', 'content']
    ordering_fields = ['due_date', 'created_at', 'priority', 'status']
    ordering = ['due_date', 'created_at']

    class Pagination(LimitOffsetPagination):
        default_limit = 200
        max_limit = 500

    pagination_class = Pagination

    def get_queryset(self):
        qs = Task.objects.for_user_households(self.request.user).select_related(
            'created_by', 'completed_by', 'assigned_to', 'project'
        ).prefetch_related('zones', 'tags__tag')

        if self.request.household:
            qs = qs.filter(household=self.request.household)

        zone_id = self.request.query_params.get('zone', '').strip()
        if zone_id:
            qs = qs.filter(zones__id=zone_id).distinct()

        if self.request.query_params.get('overdue') == 'true':
            qs = qs.filter(
                due_date__lt=timezone.now().date()
            ).exclude(status__in=['done', 'archived'])

        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.household:
            ctx['household_id'] = self.request.household.id
        return ctx

    def perform_create(self, serializer):
        zone_ids = self.request.data.get('zone_ids') or []
        if not isinstance(zone_ids, list) or not zone_ids:
            raise ValidationError({'zone_ids': 'At least one zone is required.'})

        zones = list(
            Zone.objects.for_user_households(self.request.user).filter(id__in=zone_ids)
        )
        if len(zones) != len(zone_ids):
            raise ValidationError({'zone_ids': 'One or more zones are invalid or inaccessible.'})

        household_ids = {str(z.household_id) for z in zones}
        if len(household_ids) != 1:
            raise ValidationError({'zone_ids': 'All zones must belong to the same household.'})

        zone_household_id = next(iter(household_ids))
        if self.request.household and str(self.request.household.id) != zone_household_id:
            raise ValidationError({'household_id': 'Selected household does not match provided zones.'})

        serializer.save(
            household_id=zone_household_id,
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        new_status = serializer.validated_data.get('status')
        kwargs = {'updated_by': self.request.user}

        if new_status == Task.Status.DONE and not instance.completed_at:
            kwargs['completed_at'] = timezone.now()
            kwargs['completed_by'] = self.request.user
        elif new_status and new_status != Task.Status.DONE and instance.completed_at:
            kwargs['completed_at'] = None
            kwargs['completed_by'] = None

        serializer.save(**kwargs)

    def perform_destroy(self, instance):
        if instance.created_by_id != self.request.user.pk:
            raise PermissionDenied("Only the creator can delete this task.")
        instance.status = Task.Status.ARCHIVED
        instance.updated_by = self.request.user
        instance.save(update_fields=['status', 'updated_by'])
