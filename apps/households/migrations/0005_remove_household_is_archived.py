from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('households', '0004_household_archive'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='household',
            name='is_archived',
        ),
    ]
