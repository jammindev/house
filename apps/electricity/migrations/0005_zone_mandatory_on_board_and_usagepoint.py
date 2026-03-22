# Manually written — 2026-03-22
#
# Makes zone non-nullable on ElectricityBoard and UsagePoint.
# Safe because both tables are empty after migration 0003.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("electricity", "0004_rebuild_electricity_schema"),
        ("zones", "0003_add_zone_color_constraint"),
    ]

    operations = [
        migrations.AlterField(
            model_name="electricityboard",
            name="zone",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="electricity_boards",
                to="zones.zone",
            ),
        ),
        migrations.AlterField(
            model_name="usagepoint",
            name="zone",
            field=models.ForeignKey(
                db_column="zone_id",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="electricity_usage_points",
                to="zones.zone",
            ),
        ),
    ]
