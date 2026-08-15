"""
Orchard models — the household's perennial plantings (parcours 30).

Three entities in the V1 register: the subjects themselves (``Tree``), the care
journal (``TreeEvent``) and the weighed harvests (``Harvest``). A fourth,
``CareRule``, carries the *seasonal* cadence and arrives with lot 5.

Why a dedicated journal rather than generic ``Interaction`` rows: the care
schedule is derived from a ``MAX(occurred_on)`` **grouped by rule**, which is a
GROUP BY on a FK — exactly what the project forbids doing from ``metadata`` (see
CLAUDE.md, « Interaction vs modèle dédié »). The event ``type`` is filtered and
constrained too, where a ``metadata.kind`` is stringly-typed. The accepted cost
is that orchard entries do not show in the household activity feed, same as the
coop today — a cross-cutting subject (issue #509), not a reason to duplicate the
journal.
"""
import uuid

from django.contrib.contenttypes.fields import GenericRelation
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class Tree(HouseholdScopedModel):
    """One perennial subject of the orchard — a tree, a bush, a vine.

    A single model with a ``kind`` rather than four models: pruning, treating,
    harvesting and noting are the *same* gesture for an apple tree and for a
    raspberry bush. ``kind`` drives the **display** (an ornamental is not offered
    a harvest) and the suggested values — never the schema.
    """

    class Kind(models.TextChoices):
        FRUIT_TREE = 'fruit_tree', _("Fruit tree")
        BERRY_BUSH = 'berry_bush', _("Berry bush")
        VINE = 'vine', _("Vine")
        ORNAMENTAL = 'ornamental', _("Ornamental")

    class Status(models.TextChoices):
        ALIVE = 'alive', _("Alive")
        AILING = 'ailing', _("Ailing")
        DEAD = 'dead', _("Dead")
        REMOVED = 'removed', _("Removed")

    #: Statuses counted as "still in the orchard" (default list filter).
    LIVING_STATUSES = (Status.ALIVE, Status.AILING)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.FRUIT_TREE)
    # Variety and rootstock are often approximate or lost — especially for a tree
    # planted by the previous owner. Free text, never a foreign key to a species
    # table we would have to maintain.
    species = models.CharField(max_length=200, blank=True, default='')
    rootstock = models.CharField(max_length=200, blank=True, default='')
    # "si connue" — the planting date of an inherited tree is usually unknown, and
    # the age shown on the sheet is derived from it, never stored.
    planted_on = models.DateField(null=True, blank=True)
    # Declared flowering window, used by the frost alert (lot 7). Both bounds are
    # null together: **empty means nobody filled it in**, not "never flowers" —
    # the screen must offer to fill it rather than stay silent.
    flowering_start_month = models.PositiveSmallIntegerField(null=True, blank=True)
    flowering_end_month = models.PositiveSmallIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ALIVE)
    notes = models.TextField(blank=True, default='')
    # Required, and PROTECT rather than CASCADE: the zone is a container, the tree
    # is a possession. Deleting "Garden" must not wipe fifteen years of harvests in
    # silence — a named refusal beats a silent loss.
    zone = models.ForeignKey(
        'zones.Zone',
        on_delete=models.PROTECT,
        related_name='trees',
        db_column='zone_id',
    )
    document_links = GenericRelation('documents.DocumentLink')

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'orchard_trees'
        ordering = ['name']
        indexes = [
            models.Index(fields=['household', 'status'], name='idx_tree_hh_status'),
            models.Index(fields=['zone'], name='idx_tree_zone'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=['alive', 'ailing', 'dead', 'removed']),
                name='orchard_tree_status_check',
            ),
            models.CheckConstraint(
                condition=models.Q(kind__in=['fruit_tree', 'berry_bush', 'vine', 'ornamental']),
                name='orchard_tree_kind_check',
            ),
            # Both bounds or neither: a half-declared window has no meaning, and
            # the frost alert would have to guess the missing half.
            models.CheckConstraint(
                condition=(
                    models.Q(flowering_start_month__isnull=True, flowering_end_month__isnull=True)
                    | models.Q(
                        flowering_start_month__gte=1,
                        flowering_start_month__lte=12,
                        flowering_end_month__gte=1,
                        flowering_end_month__lte=12,
                    )
                ),
                name='orchard_tree_flowering_check',
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def has_flowering_window(self) -> bool:
        return self.flowering_start_month is not None and self.flowering_end_month is not None


class TreeEvent(HouseholdScopedModel):
    """One dated entry of a subject's care journal."""

    class Type(models.TextChoices):
        PRUNING = 'pruning', _("Pruning")
        TREATMENT = 'treatment', _("Treatment")
        FERTILIZING = 'fertilizing', _("Fertilizing")
        WATERING = 'watering', _("Watering")
        TRAINING = 'training', _("Training")
        OBSERVATION = 'observation', _("Observation")
        FLOWERING = 'flowering', _("Flowering")
        OTHER = 'other', _("Other")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tree = models.ForeignKey(
        Tree,
        on_delete=models.CASCADE,
        related_name='events',
        db_column='tree_id',
    )
    # Set when this entry is what satisfied a seasonal rule. SET_NULL, not
    # CASCADE: dropping a cadence the household no longer follows must not erase
    # the proof that the work was done — the journal outlives the rule.
    care_rule = models.ForeignKey(
        'CareRule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completions',
        db_column='care_rule_id',
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    occurred_on = models.DateField()
    title = models.CharField(max_length=300)
    notes = models.TextField(blank=True, default='')

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'orchard_tree_events'
        ordering = ['-occurred_on', '-created_at']
        indexes = [
            models.Index(fields=['household', 'occurred_on'], name='idx_tree_event_hh_date'),
            models.Index(fields=['tree', '-occurred_on'], name='idx_tree_event_tree_date'),
            models.Index(fields=['care_rule', '-occurred_on'], name='idx_tree_event_rule_date'),
        ]

    def __str__(self):
        return self.title


class Harvest(HouseholdScopedModel):
    """One weighing of what a subject gave, on a date.

    A dedicated model rather than an ``Interaction``: harvests are aggregated and
    queried by season, so they can never live in JSON. And not a ``Tracker``
    either — a harvest carries a unit and a season, and a subject yields several
    times per season.
    """

    class Unit(models.TextChoices):
        KG = 'kg', _("kg")
        PIECE = 'piece', _("pieces")
        LITRE = 'litre', _("litres")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tree = models.ForeignKey(
        Tree,
        on_delete=models.CASCADE,
        related_name='harvests',
        db_column='tree_id',
    )
    harvested_on = models.DateField()
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit = models.CharField(max_length=10, choices=Unit.choices, default=Unit.KG)
    notes = models.TextField(blank=True, default='')

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'orchard_harvests'
        ordering = ['-harvested_on', '-created_at']
        indexes = [
            models.Index(fields=['household', 'harvested_on'], name='idx_harvest_hh_date'),
            models.Index(fields=['tree', '-harvested_on'], name='idx_harvest_tree_date'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name='orchard_harvest_quantity_positive',
            ),
            models.CheckConstraint(
                condition=models.Q(unit__in=['kg', 'piece', 'litre']),
                name='orchard_harvest_unit_check',
            ),
        ]

    def __str__(self):
        return f"{self.quantity} {self.unit} — {self.harvested_on}"


class CareRule(HouseholdScopedModel):
    """A recurring care gesture, expressed as a **window of months**.

    « La taille d'hiver, c'est entre novembre et mars » — not « every 365 days ».
    The three cadences already in the app are intervals, and an interval
    *remembers lateness*: pruned two weeks late once, the next due date shifts,
    and five years later the app asks for winter pruning in April — at bud break,
    exactly when it must not happen.

    ``next_due`` is **never stored**: it is derived at read time from the last
    linked ``TreeEvent`` (``orchard.seasons.rule_status``). See
    ``docs/fiches/CADENCE_SAISONNIERE.md``.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    emoji = models.CharField(max_length=16, blank=True, default='')
    start_month = models.PositiveSmallIntegerField()
    end_month = models.PositiveSmallIntegerField()
    # The journal entry a completion writes. « Bouillie bordelaise » must land as
    # a treatment, not as a pruning: the journal is filtered by type, so a rule
    # that always wrote the same type would make that filter lie.
    event_type = models.CharField(
        max_length=20,
        choices=TreeEvent.Type.choices,
        default=TreeEvent.Type.PRUNING,
    )
    # Scope: one subject, or every subject of a kind. Never both — a rule that is
    # two rules at once cannot be satisfied by one journal entry.
    tree = models.ForeignKey(
        Tree,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='care_rules',
        db_column='tree_id',
    )
    kind = models.CharField(max_length=20, choices=Tree.Kind.choices, blank=True, default='')
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')

    objects = HouseholdScopedManager()

    class Meta:
        db_table = 'orchard_care_rules'
        ordering = ['start_month', 'name']
        indexes = [
            models.Index(fields=['household', 'is_active'], name='idx_care_rule_hh_active'),
            models.Index(fields=['tree'], name='idx_care_rule_tree'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    start_month__gte=1, start_month__lte=12,
                    end_month__gte=1, end_month__lte=12,
                ),
                name='orchard_rule_months_range',
            ),
            # One scope or the other, never both.
            models.CheckConstraint(
                condition=~(models.Q(tree__isnull=False) & ~models.Q(kind='')),
                name='orchard_rule_single_scope',
            ),
        ]

    def __str__(self):
        return self.name
