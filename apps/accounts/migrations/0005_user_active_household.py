import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_remove_householdmember_household_and_more"),
        ("households", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="active_household",
            field=models.ForeignKey(
                blank=True,
                help_text="User's currently active household",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="active_for_users",
                to="households.household",
                verbose_name="active household",
            ),
        ),
    ]
