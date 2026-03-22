# Manually written — 2026-03-22
#
# Step 1 of 2: wipe all electricity data and drop the Breaker / ResidualCurrentDevice
# models so that migration 0004 can rebuild the schema from a clean slate.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("electricity", "0002_alter_breaker_options_alter_electriccircuit_options_and_more"),
    ]

    operations = [
        # ── 1. Delete all rows (leaf → root to respect FK constraints) ───────
        migrations.RunSQL(
            sql="""
                DELETE FROM electricity_circuit_usage_links;
                DELETE FROM electricity_plan_change_logs;
                DELETE FROM electricity_circuits;
                DELETE FROM electricity_breakers;
                DELETE FROM electricity_rcds;
                DELETE FROM electricity_usage_points;
                DELETE FROM electricity_boards;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),

        # ── 2. Remove the breaker FK from ElectricCircuit ────────────────────
        migrations.RemoveField(
            model_name="electriccircuit",
            name="breaker",
        ),

        # ── 3. Remove the old active-board uniqueness constraint ─────────────
        migrations.RemoveConstraint(
            model_name="electricityboard",
            name="uq_electricity_active_board_per_household",
        ),

        # ── 4. Drop old models ───────────────────────────────────────────────
        migrations.DeleteModel(name="Breaker"),
        migrations.DeleteModel(name="ResidualCurrentDevice"),
    ]
