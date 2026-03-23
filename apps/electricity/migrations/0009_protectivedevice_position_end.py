# Generated manually on 2026-03-23

from django.db import migrations, models
import django.db.models.expressions


class Migration(migrations.Migration):

    dependencies = [
        ('electricity', '0008_protectivedevice_pole_count'),
    ]

    operations = [
        # Drop the old unique constraint on (board, row, position) — range overlap
        # is now validated in the serializer layer.
        migrations.RemoveConstraint(
            model_name='protectivedevice',
            name='uq_electricity_protective_device_position_per_board',
        ),
        migrations.AddField(
            model_name='protectivedevice',
            name='position_end',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name='protectivedevice',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(position_end__isnull=True)
                    | (
                        models.Q(position__isnull=False)
                        & models.Q(position_end__gte=django.db.models.expressions.F('position'))
                    )
                ),
                name='chk_electricity_pd_position_end_valid',
            ),
        ),
    ]
