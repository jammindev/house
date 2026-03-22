# Manually written — 2026-03-22
#
# Adds an optional unique label field to ElectricityBoard.
# Safe because the table is empty after migration 0003.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("electricity", "0005_zone_mandatory_on_board_and_usagepoint"),
    ]

    operations = [
        migrations.AddField(
            model_name="electricityboard",
            name="label",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddConstraint(
            model_name="electricityboard",
            constraint=models.UniqueConstraint(
                condition=models.Q(label__isnull=False),
                fields=["household", "label"],
                name="uq_electricity_board_label_per_household",
            ),
        ),
    ]
