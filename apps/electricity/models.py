# electricity/models.py
"""Electricity domain models."""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class SupplyType(models.TextChoices):
    SINGLE_PHASE = "single_phase", _("Single phase")
    THREE_PHASE = "three_phase", _("Three phase")


class PhaseType(models.TextChoices):
    L1 = "L1", "L1"
    L2 = "L2", "L2"
    L3 = "L3", "L3"


class UsagePointKind(models.TextChoices):
    SOCKET = "socket", _("Socket")
    LIGHT = "light", _("Light")


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
    PROTECTIVE_DEVICE = "protective_device", "Protective device"
    CIRCUIT = "circuit", "Circuit"
    USAGE_POINT = "usage_point", "Usage point"
    LINK = "link", "Link"
    MAINTENANCE_EVENT = "maintenance_event", "Maintenance event"
    # max_length=20 is sufficient — longest value is "protective_device" (17 chars)


class NfC15100Compliance(models.TextChoices):
    YES = "yes", "Yes"
    NO = "no", "No"
    PARTIAL = "partial", "Partial"


class ProtectiveDeviceType(models.TextChoices):
    BREAKER = "breaker", "Breaker"
    RCD = "rcd", "RCD"
    COMBINED = "combined", "Combined"
    MAIN = "main", "Main"


class ProtectiveDeviceRole(models.TextChoices):
    MAIN = "main", "Main"
    DIVISIONARY = "divisionary", "Divisionary"
    SPARE = "spare", "Spare"


class ElectricityBoard(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=100, null=True, blank=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_boards",
    )
    zone = models.ForeignKey(
        "zones.Zone",
        on_delete=models.PROTECT,
        related_name="electricity_boards",
    )
    name = models.CharField(max_length=255, default="Tableau principal")
    supply_type = models.CharField(max_length=20, choices=SupplyType.choices)
    location = models.CharField(max_length=255, blank=True, default="")
    rows = models.PositiveSmallIntegerField(null=True, blank=True)
    slots_per_row = models.PositiveSmallIntegerField(null=True, blank=True)
    last_inspection_date = models.DateField(null=True, blank=True)
    nf_c_15100_compliant = models.CharField(
        max_length=10,
        choices=NfC15100Compliance.choices,
        null=True,
        blank=True,
    )
    main_notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_boards"
        verbose_name = _("electricity board")
        verbose_name_plural = _("electricity boards")
        constraints = [
            models.UniqueConstraint(
                fields=["household"],
                condition=models.Q(is_active=True, parent__isnull=True),
                name="uq_electricity_active_root_board_per_household",
            ),
            models.UniqueConstraint(
                fields=["household", "label"],
                condition=models.Q(label__isnull=False),
                name="uq_electricity_board_label_per_household",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.household_id})"


class ProtectiveDevice(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(
        ElectricityBoard,
        on_delete=models.CASCADE,
        related_name="protective_devices",
        db_column="board_id",
    )
    parent_rcd = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="protected_devices",
    )
    # Optional for device_type=rcd, should be set for breaker and combined
    label = models.CharField(max_length=100, null=True, blank=True)
    device_type = models.CharField(max_length=10, choices=ProtectiveDeviceType.choices)
    role = models.CharField(
        max_length=20,
        choices=ProtectiveDeviceRole.choices,
        null=True,
        blank=True,
    )
    row = models.PositiveSmallIntegerField(null=True, blank=True)
    position = models.PositiveSmallIntegerField(null=True, blank=True)
    # Optional: last occupied slot in the row. When set, device spans [position, position_end].
    # Requires position to be set; must be >= position — enforced in service layer and DB constraint.
    position_end = models.PositiveSmallIntegerField(null=True, blank=True)
    # Cross-table rule: must be null if board.supply_type=single_phase — enforced in service layer, not DB
    phase = models.CharField(
        max_length=2,
        choices=PhaseType.choices,
        null=True,
        blank=True,
    )
    rating_amps = models.PositiveIntegerField(null=True, blank=True)
    # Number of poles (1/2 for single-phase, 3/4 for three-phase).
    # rcd/combined: only 2 or 4 — enforced in service layer and DB constraint.
    pole_count = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        choices=[(1, "1 pole"), (2, "2 poles"), (3, "3 poles"), (4, "4 poles")],
    )
    # Only relevant if device_type in (breaker, combined)
    curve_type = models.CharField(
        max_length=10,
        choices=BreakerCurveType.choices,
        blank=True,
        default="",
    )
    # Only relevant if device_type in (rcd, combined)
    sensitivity_ma = models.PositiveIntegerField(null=True, blank=True)
    # Only relevant if device_type in (rcd, combined)
    type_code = models.CharField(
        max_length=10,
        choices=RCDTypeCode.choices,
        blank=True,
        default="",
    )
    # Only relevant if device_type in (rcd, combined).
    # Cross-table rule: must be null if board.supply_type=single_phase — enforced in service layer
    phase_coverage = models.JSONField(null=True, blank=True)
    brand = models.CharField(max_length=100, blank=True, default="")
    model_ref = models.CharField(max_length=100, blank=True, default="")
    installed_at = models.DateField(null=True, blank=True)
    is_spare = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_protective_devices"
        verbose_name = _("protective device")
        verbose_name_plural = _("protective devices")
        constraints = [
            # label uniqueness is conditional — pure RCDs may have no label
            models.UniqueConstraint(
                fields=["household", "label"],
                condition=models.Q(label__isnull=False),
                name="uq_electricity_protective_device_label_per_household",
            ),
            # position_end requires position, and must be >= position
            models.CheckConstraint(
                condition=(
                    models.Q(position_end__isnull=True)
                    | (
                        models.Q(position__isnull=False)
                        & models.Q(position_end__gte=models.F("position"))
                    )
                ),
                name="chk_electricity_pd_position_end_valid",
            ),
            # breakers must not carry RCD-specific fields
            models.CheckConstraint(
                check=(
                    ~models.Q(device_type="breaker")
                    | (models.Q(sensitivity_ma__isnull=True) & models.Q(type_code=""))
                ),
                name="chk_electricity_pd_breaker_no_rcd_fields",
            ),
            # pure RCDs must not carry a curve type
            models.CheckConstraint(
                check=(
                    ~models.Q(device_type="rcd")
                    | models.Q(curve_type="")
                ),
                name="chk_electricity_pd_rcd_no_curve_type",
            ),
            # row and position must both be set or both be null
            models.CheckConstraint(
                check=(
                    (models.Q(row__isnull=True) & models.Q(position__isnull=True))
                    | (models.Q(row__isnull=False) & models.Q(position__isnull=False))
                ),
                name="chk_electricity_pd_row_position_both_or_neither",
            ),
            # rcd and combined devices: pole_count must be 2 or 4 (or null)
            models.CheckConstraint(
                condition=(
                    ~models.Q(device_type__in=["rcd", "combined"])
                    | models.Q(pole_count__isnull=True)
                    | models.Q(pole_count__in=[2, 4])
                ),
                name="chk_electricity_pd_rcd_combined_pole_count",
            ),
        ]

    def clean(self):
        # Phase/supply_type cross-table validation must be done in the service layer
        if self.device_type == ProtectiveDeviceType.RCD and self.curve_type:
            raise ValidationError(
                {"curve_type": _("curve_type must be empty for device_type=rcd.")}
            )
        if self.device_type == ProtectiveDeviceType.BREAKER:
            if self.sensitivity_ma is not None:
                raise ValidationError(
                    {"sensitivity_ma": _("sensitivity_ma must be null for device_type=breaker.")}
                )
            if self.type_code:
                raise ValidationError(
                    {"type_code": _("type_code must be empty for device_type=breaker.")}
                )
            if self.phase_coverage is not None:
                raise ValidationError(
                    {"phase_coverage": _("phase_coverage must be null for device_type=breaker.")}
                )

    def __str__(self):
        return self.label or str(self.id)


class ElectricCircuit(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(
        ElectricityBoard,
        on_delete=models.CASCADE,
        related_name="circuits",
        db_column="board_id",
    )
    protective_device = models.ForeignKey(
        ProtectiveDevice,
        on_delete=models.PROTECT,
        related_name="circuits",
        db_column="protective_device_id",
    )
    label = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_circuits"
        verbose_name = _("circuit")
        verbose_name_plural = _("circuits")
        constraints = [
            models.UniqueConstraint(
                fields=["household", "label"],
                name="uq_electricity_circuit_label_per_household",
            )
        ]

    def clean(self):
        # Pure RCDs protect groups of breakers, not individual circuits.
        # A circuit must be protected by a breaker, combined, or main device.
        if (
            self.protective_device_id
            and self.protective_device.device_type == ProtectiveDeviceType.RCD
        ):
            raise ValidationError(
                {
                    "protective_device": _(
                        "A circuit cannot be directly protected by a pure RCD "
                        "(device_type=rcd). Use a breaker, combined, or main device."
                    )
                }
            )

    def __str__(self):
        return self.label


class UsagePoint(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=20, choices=UsagePointKind.choices)
    zone = models.ForeignKey(
        "zones.Zone",
        on_delete=models.PROTECT,
        related_name="electricity_usage_points",
        db_column="zone_id",
    )
    max_power_watts = models.PositiveIntegerField(null=True, blank=True)
    is_dedicated_circuit = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default="")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_usage_points"
        verbose_name = _("usage point")
        verbose_name_plural = _("usage points")
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


class MaintenanceEvent(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(
        ElectricityBoard,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_events",
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="electricity_maintenance_events",
    )
    event_date = models.DateField()
    description = models.TextField()
    entity_type = models.CharField(
        max_length=20,
        choices=ChangeEntityType.choices,
        null=True,
        blank=True,
    )
    entity_id = models.UUIDField(null=True, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_maintenance_events"
        verbose_name = _("maintenance event")
        verbose_name_plural = _("maintenance events")

    def __str__(self):
        return f"{self.event_date} - {self.description[:50]}"


# --- Consumption (parcours 10) ------------------------------------------------


class MeterTariffType(models.TextChoices):
    BASE = "base", _("Base")
    HP_HC = "hp_hc", _("Peak / off-peak")


class EnergyRegister(models.TextChoices):
    BASE = "base", _("Base")
    HP = "hp", _("Peak hours")
    HC = "hc", _("Off-peak hours")


class ConsumptionSource(models.TextChoices):
    READING = "reading", _("Meter reading")
    IMPORT = "import", _("Import")


class ElectricityMeter(HouseholdScopedModel):
    """A physical metering point — the anchor of all consumption data."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=100, blank=True, default="")
    zone = models.ForeignKey(
        "zones.Zone",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="electricity_meters",
    )
    tariff_type = models.CharField(
        max_length=10,
        choices=MeterTariffType.choices,
        default=MeterTariffType.BASE,
    )
    # IANA timezone of the metering point. Day/month bucket boundaries and the
    # daily proration of manual readings are computed in this timezone, not in
    # the server timezone (the project runs in UTC).
    timezone = models.CharField(max_length=64, default="UTC")
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_meters"
        verbose_name = _("electricity meter")
        verbose_name_plural = _("electricity meters")

    def __str__(self):
        return f"{self.name} ({self.household_id})"

    def allowed_registers(self) -> tuple[str, ...]:
        if self.tariff_type == MeterTariffType.HP_HC:
            return (EnergyRegister.HP, EnergyRegister.HC)
        return (EnergyRegister.BASE,)


class MeterReading(HouseholdScopedModel):
    """A manual reading of a meter register index at a point in time."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meter = models.ForeignKey(
        ElectricityMeter,
        on_delete=models.CASCADE,
        related_name="readings",
        db_column="meter_id",
    )
    register = models.CharField(max_length=10, choices=EnergyRegister.choices)
    reading_at = models.DateTimeField()
    index_kwh = models.DecimalField(max_digits=12, decimal_places=3)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_meter_readings"
        verbose_name = _("meter reading")
        verbose_name_plural = _("meter readings")
        constraints = [
            models.UniqueConstraint(
                fields=["meter", "register", "reading_at"],
                name="uq_electricity_reading_meter_register_at",
            ),
        ]

    def __str__(self):
        return f"{self.meter_id} {self.register} {self.reading_at:%Y-%m-%d %H:%M} = {self.index_kwh}"


class ConsumptionRecord(HouseholdScopedModel):
    """The generic consumption pivot: energy over a time interval.

    Every data source (manual readings, provider file imports) reduces to this
    shape; aggregation only ever consumes it. ``interval_minutes`` is explicit —
    no sampling step is assumed (30 min in France, 15 min in Germany…). Energy
    is stored in integer Wh to avoid cumulative float drift.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meter = models.ForeignKey(
        ElectricityMeter,
        on_delete=models.CASCADE,
        related_name="consumption_records",
        db_column="meter_id",
    )
    register = models.CharField(max_length=10, choices=EnergyRegister.choices)
    ts_start = models.DateTimeField()
    interval_minutes = models.PositiveIntegerField()
    energy_wh = models.PositiveBigIntegerField()
    source = models.CharField(max_length=10, choices=ConsumptionSource.choices)
    source_import = models.ForeignKey(
        "electricity.ConsumptionImport",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_consumption_records"
        verbose_name = _("consumption record")
        verbose_name_plural = _("consumption records")
        constraints = [
            # ``source`` is part of the key so a reading-derived estimate can
            # coexist with an imported point starting at the same instant,
            # while imports still dedupe against imports (idempotent re-import).
            models.UniqueConstraint(
                fields=["meter", "register", "ts_start", "source"],
                name="uq_electricity_consumption_natural_key",
            ),
        ]
        indexes = [
            models.Index(fields=["household", "meter", "ts_start"], name="idx_elec_consumption_lookup"),
        ]

    def __str__(self):
        return f"{self.meter_id} {self.register} {self.ts_start:%Y-%m-%d %H:%M} +{self.interval_minutes}min = {self.energy_wh} Wh"


class MeterTariff(HouseholdScopedModel):
    """A pricing period of a meter — TTC €/kWh per register + monthly subscription.

    The tariff applicable on a local day (meter timezone) is the row with the
    latest ``valid_from`` ≤ that day. Which price fields are set is constrained
    by the meter's ``tariff_type`` (enforced in the serializer): ``base`` meters
    carry ``price_base`` only, ``hp_hc`` meters carry ``price_hp`` + ``price_hc``.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meter = models.ForeignKey(
        ElectricityMeter,
        on_delete=models.CASCADE,
        related_name="tariffs",
        db_column="meter_id",
    )
    valid_from = models.DateField()
    price_base = models.DecimalField(max_digits=8, decimal_places=5, null=True, blank=True)
    price_hp = models.DecimalField(max_digits=8, decimal_places=5, null=True, blank=True)
    price_hc = models.DecimalField(max_digits=8, decimal_places=5, null=True, blank=True)
    subscription_eur_month = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_meter_tariffs"
        verbose_name = _("meter tariff")
        verbose_name_plural = _("meter tariffs")
        ordering = ["-valid_from"]
        constraints = [
            models.UniqueConstraint(
                fields=["meter", "valid_from"],
                name="uq_electricity_tariff_meter_valid_from",
            ),
        ]

    def __str__(self):
        return f"{self.meter_id} @ {self.valid_from}"


class ImportStatus(models.TextChoices):
    COMPLETED = "completed", _("Completed")
    FAILED = "failed", _("Failed")


class ConsumptionImport(HouseholdScopedModel):
    """Audit trail of one consumption file import (idempotent by design)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meter = models.ForeignKey(
        ElectricityMeter,
        on_delete=models.CASCADE,
        related_name="consumption_imports",
        db_column="meter_id",
    )
    provider = models.CharField(max_length=50)
    filename = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=10, choices=ImportStatus.choices)
    created_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True, default="")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "electricity_consumption_imports"
        verbose_name = _("consumption import")
        verbose_name_plural = _("consumption imports")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.provider} {self.filename} ({self.status})"
