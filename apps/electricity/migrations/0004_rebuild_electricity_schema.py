# Manually written — 2026-03-22
#
# Step 2 of 2: rebuild the electricity schema on top of the now-empty tables
# produced by migration 0003.  All non-nullable FKs are safe to add without a
# default because every affected table was truncated in 0003.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("electricity", "0003_wipe_breaker_rcd"),
        ("zones", "0003_add_zone_color_constraint"),
        ("households", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [

        # ── ElectricityBoard — new fields ────────────────────────────────────
        migrations.AddField(
            model_name="electricityboard",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sub_boards",
                to="electricity.electricityboard",
            ),
        ),
        migrations.AddField(
            model_name="electricityboard",
            name="zone",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="electricity_boards",
                to="zones.zone",
            ),
        ),
        migrations.AddField(
            model_name="electricityboard",
            name="location",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="electricityboard",
            name="rows",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="electricityboard",
            name="slots_per_row",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="electricityboard",
            name="last_inspection_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="electricityboard",
            name="nf_c_15100_compliant",
            field=models.CharField(
                blank=True,
                choices=[("yes", "Yes"), ("no", "No"), ("partial", "Partial")],
                max_length=10,
                null=True,
            ),
        ),

        # ── ElectricityBoard — replace active-board constraint ───────────────
        migrations.AddConstraint(
            model_name="electricityboard",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_active=True, parent__isnull=True),
                fields=["household"],
                name="uq_electricity_active_root_board_per_household",
            ),
        ),

        # ── ProtectiveDevice — create model ──────────────────────────────────
        migrations.CreateModel(
            name="ProtectiveDevice",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "household",
                    models.ForeignKey(
                        db_column="household_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)s_set",
                        to="households.household",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        db_column="created_by",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        db_column="updated_by",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "board",
                    models.ForeignKey(
                        db_column="board_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="protective_devices",
                        to="electricity.electricityboard",
                    ),
                ),
                (
                    "parent_rcd",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="protected_devices",
                        to="electricity.protectivedevice",
                    ),
                ),
                ("label", models.CharField(blank=True, max_length=100, null=True)),
                (
                    "device_type",
                    models.CharField(
                        choices=[
                            ("breaker", "Breaker"),
                            ("rcd", "RCD"),
                            ("combined", "Combined"),
                            ("main", "Main"),
                        ],
                        max_length=10,
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("main", "Main"),
                            ("divisionary", "Divisionary"),
                            ("spare", "Spare"),
                        ],
                        max_length=20,
                        null=True,
                    ),
                ),
                ("row", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("position", models.PositiveSmallIntegerField(blank=True, null=True)),
                (
                    "phase",
                    models.CharField(
                        blank=True,
                        choices=[("L1", "L1"), ("L2", "L2"), ("L3", "L3")],
                        max_length=2,
                        null=True,
                    ),
                ),
                ("rating_amps", models.PositiveIntegerField(blank=True, null=True)),
                (
                    "curve_type",
                    models.CharField(
                        blank=True,
                        choices=[("b", "B"), ("c", "C"), ("d", "D"), ("other", "Other")],
                        default="",
                        max_length=10,
                    ),
                ),
                ("sensitivity_ma", models.PositiveIntegerField(blank=True, null=True)),
                (
                    "type_code",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("ac", "AC"),
                            ("a", "A"),
                            ("f", "F"),
                            ("b", "B"),
                            ("other", "Other"),
                        ],
                        default="",
                        max_length=10,
                    ),
                ),
                ("phase_coverage", models.JSONField(blank=True, null=True)),
                ("brand", models.CharField(blank=True, default="", max_length=100)),
                ("model_ref", models.CharField(blank=True, default="", max_length=100)),
                ("installed_at", models.DateField(blank=True, null=True)),
                ("is_spare", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("notes", models.TextField(blank=True, default="")),
            ],
            options={
                "verbose_name": "protective device",
                "verbose_name_plural": "protective devices",
                "db_table": "electricity_protective_devices",
            },
        ),
        migrations.AddConstraint(
            model_name="protectivedevice",
            constraint=models.UniqueConstraint(
                condition=models.Q(label__isnull=False),
                fields=["household", "label"],
                name="uq_electricity_protective_device_label_per_household",
            ),
        ),
        migrations.AddConstraint(
            model_name="protectivedevice",
            constraint=models.UniqueConstraint(
                condition=models.Q(row__isnull=False, position__isnull=False),
                fields=["board", "row", "position"],
                name="uq_electricity_protective_device_position_per_board",
            ),
        ),
        migrations.AddConstraint(
            model_name="protectivedevice",
            constraint=models.CheckConstraint(
                check=(
                    ~models.Q(device_type="breaker")
                    | (models.Q(sensitivity_ma__isnull=True) & models.Q(type_code=""))
                ),
                name="chk_electricity_pd_breaker_no_rcd_fields",
            ),
        ),
        migrations.AddConstraint(
            model_name="protectivedevice",
            constraint=models.CheckConstraint(
                check=(~models.Q(device_type="rcd") | models.Q(curve_type="")),
                name="chk_electricity_pd_rcd_no_curve_type",
            ),
        ),
        migrations.AddConstraint(
            model_name="protectivedevice",
            constraint=models.CheckConstraint(
                check=(
                    (models.Q(row__isnull=True) & models.Q(position__isnull=True))
                    | (models.Q(row__isnull=False) & models.Q(position__isnull=False))
                ),
                name="chk_electricity_pd_row_position_both_or_neither",
            ),
        ),

        # ── ElectricCircuit — add protective_device FK (table is empty) ──────
        migrations.AddField(
            model_name="electriccircuit",
            name="protective_device",
            field=models.ForeignKey(
                db_column="protective_device_id",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="circuits",
                to="electricity.protectivedevice",
            ),
        ),

        # ── PlanChangeLog — update entity_type choices ───────────────────────
        migrations.AlterField(
            model_name="planchangelog",
            name="entity_type",
            field=models.CharField(
                choices=[
                    ("board", "Board"),
                    ("protective_device", "Protective device"),
                    ("circuit", "Circuit"),
                    ("usage_point", "Usage point"),
                    ("link", "Link"),
                    ("maintenance_event", "Maintenance event"),
                ],
                max_length=20,
            ),
        ),

        # ── UsagePoint — new fields ──────────────────────────────────────────
        migrations.AddField(
            model_name="usagepoint",
            name="max_power_watts",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="usagepoint",
            name="is_dedicated_circuit",
            field=models.BooleanField(default=False),
        ),

        # ── MaintenanceEvent — create model ──────────────────────────────────
        migrations.CreateModel(
            name="MaintenanceEvent",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "household",
                    models.ForeignKey(
                        db_column="household_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)s_set",
                        to="households.household",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        db_column="created_by",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        db_column="updated_by",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "board",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="maintenance_events",
                        to="electricity.electricityboard",
                    ),
                ),
                (
                    "performed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="electricity_maintenance_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("event_date", models.DateField()),
                ("description", models.TextField()),
                (
                    "entity_type",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("board", "Board"),
                            ("protective_device", "Protective device"),
                            ("circuit", "Circuit"),
                            ("usage_point", "Usage point"),
                            ("link", "Link"),
                            ("maintenance_event", "Maintenance event"),
                        ],
                        max_length=20,
                        null=True,
                    ),
                ),
                ("entity_id", models.UUIDField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "maintenance event",
                "verbose_name_plural": "maintenance events",
                "db_table": "electricity_maintenance_events",
            },
        ),
    ]
