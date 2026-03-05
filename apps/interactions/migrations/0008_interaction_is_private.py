from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("interactions", "0007_alter_interactionstructure_structure"),
    ]

    operations = [
        migrations.AddField(
            model_name="interaction",
            name="is_private",
            field=models.BooleanField(default=False, help_text="Whether this interaction is private to the creator"),
        ),
        migrations.AddIndex(
            model_name="interaction",
            index=models.Index(fields=["is_private"], name="idx_int_private"),
        ),
    ]
