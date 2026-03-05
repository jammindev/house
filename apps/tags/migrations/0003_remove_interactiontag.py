from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tags", "0002_taglink_generic"),
    ]

    operations = [
        migrations.DeleteModel(
            name="InteractionTag",
        ),
    ]
