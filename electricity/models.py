# electricity/models.py
"""Electricity domain models."""

import uuid

from django.conf import settings
from django.db import models

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class SupplyType(models.TextChoices):
    SINGLE_PHASE = "single_phase", "Single phase"
    THREE_PHASE = "three_phase", "Three phase"


class PhaseType(models.TextChoices):
    L1 = "L1", "L1"
    L2 = "L2", "L2"
    L3 = "L3", "L3"


class UsagePointKind(models.TextChoices):
    SOCKET = "socket", "Socket"
    LIGHT = "light", "Light"


class RCDTypeCode(models.TextChoices):
    AC = "ac", "AC"
    A = "a", "A"
    F = "f", "F"
    B = "b", "B"
    OTHER = "other", "Other"


class BreakerCurveType(models.TextChoices):
    B = "b", "B"
    C = "c", "C"
    D = "d", "D"
    OTHER = "other", "Other"


class ChangeAction(models.TextChoices):
    CREATE = "create", "Create"
    UPDATE = "update", "Update"
    DEACTIVATE = "deactivate", "Deactivate"


class ChangeEntityType(models.TextChoices):
    BOARD = "board", "Board"
    RCD = "rcd", "RCD"
    BREAKER = "breaker", "Breaker"
    CIRCUIT = "circuit", "Circuit"
    USAGE_POINT = "usage_point", "Usage point"
    LINK = "link", "Link"


class ElectricityBoard(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, default="Tableau principal")
    supply_type = models.CharField(max_length=20, choices=SupplyType.choices)
    main_notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_boards"
        constraints = [
            models.UniqueConstraint(
                fields=["household"],
                condition=models.Q(is_active=True),
                name="uq_electricity_active_board_per_household",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.household_id})"


class ResidualCurrentDevice(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(
        ElectricityBoard,
        on_delete=models.CASCADE,
        related_name="rcds",
        db_column="board_id",
    )
    label = models.CharField(max_length=100)
    rating_amps = models.PositiveIntegerField(null=True, blank=True)
    sensitivity_ma = models.PositiveIntegerField(null=True, blank=True)
    type_code = models.CharField(
        max_length=10,
        choices=RCDTypeCode.choices,
        blank=True,
        default="",
    )
    notes = models.TextField(blank=True, default="")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_rcds"
        constraints = [
            models.UniqueConstraint(
                fields=["household", "label"],
                name="uq_electricity_rcd_label_per_household",
            )
        ]

    def __str__(self):
        return self.label


class Breaker(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(
        ElectricityBoard,
        on_delete=models.CASCADE,
        related_name="breakers",
        db_column="board_id",
    )
    rcd = models.ForeignKey(
        ResidualCurrentDevice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="breakers",
        db_column="rcd_id",
    )
    label = models.CharField(max_length=100)
    rating_amps = models.PositiveIntegerField()
    curve_type = models.CharField(
        max_length=10,
        choices=BreakerCurveType.choices,
        blank=True,
        default="",
    )
    notes = models.TextField(blank=True, default="")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_breakers"
        constraints = [
            models.UniqueConstraint(
                fields=["household", "label"],
                name="uq_electricity_breaker_label_per_household",
            )
        ]

    def __str__(self):
        return self.label


class ElectricCircuit(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(
        ElectricityBoard,
        on_delete=models.CASCADE,
        related_name="circuits",
        db_column="board_id",
    )
    breaker = models.ForeignKey(
        Breaker,
        on_delete=models.PROTECT,
        related_name="circuits",
        db_column="breaker_id",
    )
    label = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    phase = models.CharField(
        max_length=2,
        choices=PhaseType.choices,
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_circuits"
        constraints = [
            models.UniqueConstraint(
                fields=["household", "label"],
                name="uq_electricity_circuit_label_per_household",
            )
        ]

    def __str__(self):
        return self.label


class UsagePoint(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=20, choices=UsagePointKind.choices)
    zone = models.ForeignKey(
        "zones.Zone",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="electricity_usage_points",
        db_column="zone_id",
    )
    notes = models.TextField(blank=True, default="")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_usage_points"
        constraints = [
            models.UniqueConstraint(
                fields=["household", "label"],
                name="uq_electricity_usage_point_label_per_household",
            )
        ]

    def __str__(self):
        return self.label


class CircuitUsagePointLink(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    circuit = models.ForeignKey(
        ElectricCircuit,
        on_delete=models.CASCADE,
        related_name="usage_links",
        db_column="circuit_id",
    )
    usage_point = models.ForeignKey(
        UsagePoint,
        on_delete=models.CASCADE,
        related_name="circuit_links",
        db_column="usage_point_id",
    )
    is_active = models.BooleanField(default=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    deactivated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="electricity_links_deactivated",
        db_column="deactivated_by",
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_circuit_usage_links"
        constraints = [
            models.UniqueConstraint(
                fields=["usage_point"],
                condition=models.Q(is_active=True),
                name="uq_electricity_active_link_per_usage_point",
            )
        ]

    def __str__(self):
        return f"{self.circuit_id} -> {self.usage_point_id}"


class PlanChangeLog(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="electricity_plan_changes",
        db_column="actor_id",
    )
    action = models.CharField(max_length=20, choices=ChangeAction.choices)
    entity_type = models.CharField(max_length=20, choices=ChangeEntityType.choices)
    entity_id = models.UUIDField()
    payload = models.JSONField(default=dict, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_plan_change_logs"
        indexes = [
            models.Index(fields=["household", "entity_type"], name="idx_el_chlog_hh_entity"),
            models.Index(fields=["household", "created_at"], name="idx_el_chlog_hh_created"),
        ]

    def __str__(self):
        return f"{self.entity_type}:{self.entity_id} ({self.action})"
