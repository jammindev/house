from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("interactions", "0009_migrate_array_tags_to_tag_links"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="interaction",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    type__in=[
                        "note",
                        "todo",
                        "expense",
                        "maintenance",
                        "repair",
                        "installation",
                        "inspection",
                        "warranty",
                        "issue",
                        "upgrade",
                        "replacement",
                        "disposal",
                    ]
                ),
                name="interactions_type_check",
            ),
        ),
        migrations.AddConstraint(
            model_name="interaction",
            constraint=models.CheckConstraint(
                condition=models.Q(status__isnull=True)
                | models.Q(status__in=["backlog", "pending", "in_progress", "done", "archived"]),
                name="interactions_status_check",
            ),
        ),
    ]
