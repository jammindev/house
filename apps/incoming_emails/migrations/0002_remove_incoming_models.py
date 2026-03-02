from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("incoming_emails", "0001_initial"),
    ]

    operations = [
        migrations.DeleteModel(
            name="IncomingEmailAttachment",
        ),
        migrations.DeleteModel(
            name="IncomingEmail",
        ),
    ]
