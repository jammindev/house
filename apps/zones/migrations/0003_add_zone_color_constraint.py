from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("zones", "0002_alter_zone_options"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="zone",
            constraint=models.CheckConstraint(
                condition=models.Q(color__regex=r"^#[0-9A-Fa-f]{6}$"),
                name="zones_color_hex_check",
            ),
        ),
    ]
