"""
Chicken coop models — family-scale flock keeping (parcours 14).

Three entities: the flock register (Chicken), the daily egg log (EggLog, one
row per household per day, upserted) and the flock journal (ChickenEvent —
care, illness, broodiness, death…). Feed stays in the existing stock/trackers
modules; ChickenSettings only references the household's feed tracker.
"""
import uuid

from django.db import models

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class Chicken(HouseholdScopedModel):
    """One hen of the household flock."""

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        BROODY = 'broody', 'Broody'
        SICK = 'sick', 'Sick'
        DECEASED = 'deceased', 'Deceased'
        GONE = 'gone', 'Gone'

    # Statuses counted as "in the flock" (headcount, default list filter).
    FLOCK_STATUSES = (Status.ACTIVE, Status.BROODY, Status.SICK)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    breed = models.CharField(max_length=200, blank=True, default='')
    color = models.CharField(max_length=100, blank=True, default='')
    # Hatch dates are usually approximate for family flocks — a date is enough.
    hatched_on = models.DateField(null=True, blank=True)
    acquired_on = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    notes = models.TextField(blank=True, default='')
    zone = models.ForeignKey(
        'zones.Zone',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chickens',
        db_column='zone_id',
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'chickens'
        ordering = ['name']
        indexes = [
            models.Index(fields=['household', 'status'], name='idx_chicken_hh_status'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    status__in=['active', 'broody', 'sick', 'deceased', 'gone']
                ),
                name='chickens_status_check',
            ),
        ]

    def __str__(self):
        return self.name


class EggLog(HouseholdScopedModel):
    """Daily egg count — one row per household per day (upserted, never duplicated)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField()
    count = models.PositiveIntegerField()
    note = models.CharField(max_length=500, blank=True, default='')

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'chicken_egg_logs'
        ordering = ['-date']
        constraints = [
            models.UniqueConstraint(
                fields=['household', 'date'], name='uniq_egg_log_hh_date'
            ),
        ]
        indexes = [
            models.Index(fields=['household', 'date'], name='idx_egg_log_hh_date'),
        ]

    def __str__(self):
        return f"{self.date}: {self.count}"


class ChickenEvent(HouseholdScopedModel):
    """Flock journal entry — optionally tied to one hen, or flock-wide when chicken is null."""

    class Type(models.TextChoices):
        ARRIVAL = 'arrival', 'Arrival'
        CARE = 'care', 'Care'
        ILLNESS = 'illness', 'Illness'
        BROODY = 'broody', 'Broody'
        MOLT = 'molt', 'Molt'
        PREDATOR = 'predator', 'Predator'
        DEATH = 'death', 'Death'
        DEPARTURE = 'departure', 'Departure'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chicken = models.ForeignKey(
        Chicken,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='events',
        db_column='chicken_id',
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    occurred_on = models.DateField()
    title = models.CharField(max_length=300)
    notes = models.TextField(blank=True, default='')

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'chicken_events'
        ordering = ['-occurred_on', '-created_at']
        indexes = [
            models.Index(fields=['household', 'occurred_on'], name='idx_ck_event_hh_date'),
            models.Index(fields=['chicken'], name='idx_ck_event_chicken'),
        ]

    def __str__(self):
        return self.title


class ChickenSettings(HouseholdScopedModel):
    """Per-household module settings — currently just the feed tracker reference.

    The feed reserve/rate live in the referenced CONSUMPTION tracker (trackers
    app); this model only points at it, no duplication.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    feed_tracker = models.ForeignKey(
        'trackers.Tracker',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        db_column='feed_tracker_id',
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'chicken_settings'
        constraints = [
            models.UniqueConstraint(fields=['household'], name='uniq_chicken_settings_hh'),
        ]

    def __str__(self):
        return f"chicken settings — {self.household_id}"
