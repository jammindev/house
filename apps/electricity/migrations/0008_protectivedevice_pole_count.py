# Generated manually on 2026-03-23

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('electricity', '0007_remove_phase_from_circuit'),
    ]

    operations = [
        migrations.AddField(
            model_name='protectivedevice',
            name='pole_count',
            field=models.PositiveSmallIntegerField(
                blank=True,
                null=True,
                choices=[(1, '1 pole'), (2, '2 poles'), (3, '3 poles'), (4, '4 poles')],
            ),
        ),
        migrations.AddConstraint(
            model_name='protectivedevice',
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(device_type__in=['rcd', 'combined'])
                    | models.Q(pole_count__isnull=True)
                    | models.Q(pole_count__in=[2, 4])
                ),
                name='chk_electricity_pd_rcd_combined_pole_count',
            ),
        ),
    ]
