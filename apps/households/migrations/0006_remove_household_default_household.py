from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('households', '0005_remove_household_is_archived'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='household',
            name='default_household',
        ),
    ]
