"""
Task model — standalone tasks for household management.
Decoupled from Interaction to support assignment, completion tracking, etc.
"""
import uuid
from django.db import models
from django.contrib.contenttypes.fields import GenericRelation
from django.conf import settings
from core.models import HouseholdScopedModel
from core.managers import HouseholdScopedManager



class Task(HouseholdScopedModel):
    """
    A household task with optional due date, assignee, and completion tracking.
    """

    class Status(models.TextChoices):
        BACKLOG = 'backlog', 'Backlog'
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        DONE = 'done', 'Done'
        ARCHIVED = 'archived', 'Archived'

    class Priority(models.IntegerChoices):
        HIGH = 1, 'Haute'
        NORMAL = 2, 'Normale'
        LOW = 3, 'Basse'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.CharField(max_length=500)
    content = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=50,
        choices=Status.choices,
        default=Status.PENDING,
    )
    priority = models.IntegerField(
        choices=Priority.choices,
        default=Priority.NORMAL,
        null=True,
        blank=True,
    )
    due_date = models.DateField(null=True, blank=True)
    is_private = models.BooleanField(default=False)

    # Assignation
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks',
        db_column='assigned_to_id',
    )

    # Completion tracking
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_tasks',
        db_column='completed_by_id',
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    # Relations
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks',
        db_column='project_id',
    )
    zones = models.ManyToManyField(
        'zones.Zone',
        through='TaskZone',
        related_name='tasks',
    )
    source_interaction = models.ForeignKey(
        'interactions.Interaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='derived_tasks',
        db_column='source_interaction_id',
        help_text="Interaction this task was created from (or migrated from)",
    )
    tags = GenericRelation(
        'tags.TagLink',
        content_type_field='content_type',
        object_id_field='object_id',
        related_query_name='task',
    )
    metadata = models.JSONField(default=dict, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'tasks'
        ordering = ['due_date', 'created_at']
        indexes = [
            models.Index(fields=['household', 'status'], name='idx_task_hh_status'),
            models.Index(fields=['household', 'due_date'], name='idx_task_hh_due'),
            models.Index(fields=['assigned_to'], name='idx_task_assigned'),
            models.Index(fields=['project'], name='idx_task_project'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    status__in=['backlog', 'pending', 'in_progress', 'done', 'archived']
                ),
                name='tasks_status_check',
            ),
            models.CheckConstraint(
                condition=models.Q(priority__isnull=True)
                | models.Q(priority__in=[1, 2, 3]),
                name='tasks_priority_check',
            ),
            models.CheckConstraint(
                condition=models.Q(completed_at__isnull=True)
                | models.Q(completed_by__isnull=False),
                name='tasks_completed_integrity',
            ),
            models.CheckConstraint(
                condition=models.Q(is_private=False)
                | models.Q(assigned_to__isnull=True),
                name='tasks_private_not_assigned',
            ),
        ]

    def __str__(self):
        return self.subject


class TaskZone(models.Model):
    """M2M through table linking tasks to zones."""

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        db_column='task_id',
    )
    zone = models.ForeignKey(
        'zones.Zone',
        on_delete=models.CASCADE,
        db_column='zone_id',
    )

    class Meta:
        db_table = 'task_zones'
        unique_together = [['task', 'zone']]
        indexes = [
            models.Index(fields=['task']),
            models.Index(fields=['zone']),
        ]


class TaskDocument(models.Model):
    """M2M through table linking tasks to documents."""

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='task_documents',
    )
    document = models.ForeignKey(
        'documents.Document',
        on_delete=models.CASCADE,
        related_name='task_documents',
    )
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = 'task_documents'
        unique_together = [['task', 'document']]

    @property
    def household_id(self):
        return self.task.household_id


class TaskInteraction(models.Model):
    """M2M through table linking tasks to interactions."""

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='task_interactions',
    )
    interaction = models.ForeignKey(
        'interactions.Interaction',
        on_delete=models.CASCADE,
        related_name='task_links',
    )
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = 'task_interactions'
        unique_together = [['task', 'interaction']]

    @property
    def household_id(self):
        return self.task.household_id
