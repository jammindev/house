from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('households', '0006_remove_household_default_household'),
    ]

    operations = [
        migrations.AddField(
            model_name='household',
            name='postal_code',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AlterField(
            model_name='household',
            name='country',
            field=models.CharField(
                blank=True,
                default='',
                help_text='ISO 3166-1 alpha-2 country code (e.g. FR, DE, US)',
                max_length=2,
            ),
        ),
        migrations.AddField(
            model_name='household',
            name='timezone',
            field=models.CharField(
                blank=True,
                default='',
                help_text='IANA timezone (e.g. Europe/Paris). Leave blank for UTC.',
                max_length=64,
            ),
        ),
    ]
