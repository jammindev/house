from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('households', '0003_household_invitation_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='household',
            name='is_archived',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='household',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
