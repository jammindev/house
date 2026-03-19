"""
Task REST API views.
"""
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsHouseholdMember
from documents.models import Document
from interactions.models import Interaction
from zones.models import Zone
from .models import Task, TaskDocument, TaskInteraction
from .serializers import (
    TaskSerializer,
    TaskDocumentLinkSerializer,
    TaskInteractionLinkSerializer,
)


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
        ).prefetch_related(
            'zones', 'tags__tag',
            'task_documents__document',
            'task_interactions__interaction',
        )

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


class TaskDocumentViewSet(viewsets.ModelViewSet):
    """CRUD for Task↔Document links."""

    permission_classes = [IsHouseholdMember]
    serializer_class = TaskDocumentLinkSerializer

    def get_queryset(self):
        qs = TaskDocument.objects.filter(
            task__household_id__in=self.request.user.householdmember_set.values_list(
                'household_id', flat=True
            )
        ).select_related('document', 'task')
        if self.request.household:
            qs = qs.filter(task__household=self.request.household)
        task_id = self.request.query_params.get('task', '').strip()
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs

    def perform_create(self, serializer):
        task = serializer.validated_data['task']
        document = serializer.validated_data['document']
        if not Task.objects.for_user_households(self.request.user).filter(id=task.id).exists():
            raise ValidationError({'task': 'Invalid task or access denied.'})
        if str(document.household_id) != str(task.household_id):
            raise ValidationError(
                {'document': 'Document must belong to the same household as the task.'}
            )
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        task = serializer.validated_data['task']
        document = serializer.validated_data['document']
        if TaskDocument.objects.filter(task=task, document=document).exists():
            return Response(
                {'code': 'already_linked', 'detail': 'This document is already linked to this task.'},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            self.perform_create(serializer)
        except IntegrityError:
            return Response(
                {'code': 'already_linked', 'detail': 'This document is already linked to this task.'},
                status=status.HTTP_409_CONFLICT,
            )

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class TaskInteractionViewSet(viewsets.ModelViewSet):
    """CRUD for Task↔Interaction links."""

    permission_classes = [IsHouseholdMember]
    serializer_class = TaskInteractionLinkSerializer

    def get_queryset(self):
        qs = TaskInteraction.objects.filter(
            task__household_id__in=self.request.user.householdmember_set.values_list(
                'household_id', flat=True
            )
        ).select_related('interaction', 'task')
        if self.request.household:
            qs = qs.filter(task__household=self.request.household)
        task_id = self.request.query_params.get('task', '').strip()
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs

    def perform_create(self, serializer):
        task = serializer.validated_data['task']
        interaction = serializer.validated_data['interaction']
        if not Task.objects.for_user_households(self.request.user).filter(id=task.id).exists():
            raise ValidationError({'task': 'Invalid task or access denied.'})
        if str(interaction.household_id) != str(task.household_id):
            raise ValidationError(
                {'interaction': 'Interaction must belong to the same household as the task.'}
            )
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        task = serializer.validated_data['task']
        interaction = serializer.validated_data['interaction']
        if TaskInteraction.objects.filter(task=task, interaction=interaction).exists():
            return Response(
                {'code': 'already_linked', 'detail': 'This interaction is already linked to this task.'},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            self.perform_create(serializer)
        except IntegrityError:
            return Response(
                {'code': 'already_linked', 'detail': 'This interaction is already linked to this task.'},
                status=status.HTTP_409_CONFLICT,
            )

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
