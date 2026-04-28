from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('zones', '0004_root_zone_unique'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='zone',
            constraint=models.UniqueConstraint(
                condition=models.Q(('parent__isnull', True)),
                fields=('household',),
                name='zones_one_root_per_household',
            ),
        ),
    ]
