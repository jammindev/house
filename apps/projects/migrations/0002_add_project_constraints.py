from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="project",
            constraint=models.CheckConstraint(
                condition=models.Q(priority__gte=1) & models.Q(priority__lte=5),
                name="projects_priority_between_1_5",
            ),
        ),
        migrations.AddConstraint(
            model_name="project",
            constraint=models.CheckConstraint(
                condition=models.Q(planned_budget__gte=0),
                name="projects_planned_budget_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="project",
            constraint=models.CheckConstraint(
                condition=models.Q(actual_cost_cached__gte=0),
                name="projects_actual_cost_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="project",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(start_date__isnull=True)
                    | models.Q(due_date__isnull=True)
                    | models.Q(due_date__gte=models.F("start_date"))
                ),
                name="projects_dates_consistent",
            ),
        ),
    ]
