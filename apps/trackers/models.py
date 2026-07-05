"""
Tracker models — dated numeric value series attached to the household.

A Tracker is a series of dated numeric entries (water meter, weight, tank
level, running hours, project budget…). It can be general, attached to a
project (FK, like Task.project) or linked to any household entity through a
generic target (same polymorphic pattern as Interaction.source_*).
"""
import uuid

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class Tracker(HouseholdScopedModel):
    """A named series of dated numeric values."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    unit = models.CharField(max_length=50, blank=True, default='')
    emoji = models.CharField(max_length=16, blank=True, default='')
    # DELETE through the API archives instead of destroying (history has value).
    is_active = models.BooleanField(default=True)

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trackers',
        db_column='project_id',
    )
    target_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="Polymorphic target: type of the entity this tracker is about.",
    )
    target_object_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Polymorphic target: id of the entity this tracker is about.",
    )
    target = GenericForeignKey('target_content_type', 'target_object_id')

    # Denormalized caches — recomputed from the DB by services.refresh_tracker_cache
    # on every entry write (never incremented), so they cannot drift.
    last_value = models.DecimalField(
        max_digits=12, decimal_places=3, null=True, blank=True
    )
    last_entry_at = models.DateTimeField(null=True, blank=True)
    # RAG bridge: text rendering of the latest entries (with deltas), regenerated
    # on every entry write. Included in the agent SearchableSpec search_fields so
    # values are citable through the standard retrieval, with zero change to
    # apps/agent/ (same mechanism as Device.state_summary, parcours 09).
    entries_summary = models.TextField(blank=True, default='')

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'trackers'
        ordering = ['-last_entry_at', 'name']
        indexes = [
            models.Index(fields=['household', 'is_active'], name='idx_tracker_hh_active'),
            models.Index(fields=['project'], name='idx_tracker_project'),
            models.Index(
                fields=['target_content_type', 'target_object_id'],
                name='idx_tracker_target',
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(target_content_type__isnull=True, target_object_id__isnull=True)
                    | models.Q(target_content_type__isnull=False, target_object_id__isnull=False)
                ),
                name='tracker_target_integrity',
            ),
        ]

    def __str__(self):
        return self.name


class TrackerEntry(HouseholdScopedModel):
    """A dated numeric measurement of a tracker. Deleting is a hard delete."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tracker = models.ForeignKey(
        Tracker,
        on_delete=models.CASCADE,
        related_name='entries',
        db_column='tracker_id',
    )
    value = models.DecimalField(max_digits=12, decimal_places=3)
    occurred_at = models.DateTimeField()
    note = models.CharField(max_length=500, blank=True, default='')

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'tracker_entries'
        ordering = ['-occurred_at', '-created_at']
        indexes = [
            models.Index(fields=['tracker', '-occurred_at'], name='idx_tent_tracker_date'),
        ]
        verbose_name_plural = 'tracker entries'

    def __str__(self):
        return f"{self.tracker_id} — {self.value} @ {self.occurred_at:%Y-%m-%d}"
