"""
Data migration: copy Interaction(type='todo') → Task.
Migrates zones M2M and tags (GenericRelation via ContentType).
"""
from datetime import date
from django.db import migrations


def migrate_todos_to_tasks(apps, schema_editor):
    Interaction = apps.get_model('interactions', 'Interaction')
    Task = apps.get_model('tasks', 'Task')
    TaskZone = apps.get_model('tasks', 'TaskZone')
    InteractionZone = apps.get_model('interactions', 'InteractionZone')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    TagLink = apps.get_model('tags', 'TagLink')

    interaction_ct = ContentType.objects.get_for_model(Interaction)
    task_ct = ContentType.objects.get_for_model(Task)

    todos = Interaction.objects.filter(type='todo').select_related(
        'project', 'created_by', 'updated_by', 'household'
    )

    for interaction in todos:
        # Parse due_date from metadata
        due_date = None
        due_date_str = (interaction.metadata or {}).get('due_date')
        if due_date_str:
            try:
                due_date = date.fromisoformat(due_date_str)
            except (ValueError, TypeError):
                pass

        # Approximate completed_by/completed_at from updated_by when done
        completed_at = None
        completed_by = None
        if interaction.status == 'done':
            completed_at = interaction.updated_at
            completed_by = interaction.updated_by or interaction.created_by

        task = Task(
            household=interaction.household,
            subject=interaction.subject,
            content=interaction.content,
            status=interaction.status or 'pending',
            priority=2,  # default: Normale
            due_date=due_date,
            is_private=interaction.is_private,
            project=interaction.project,
            source_interaction=interaction,
            assigned_to=None,
            completed_by=completed_by,
            completed_at=completed_at,
            created_by=interaction.created_by,
            updated_by=interaction.updated_by,
            metadata={},
        )
        # Preserve original timestamps by using update after creation
        task.save()
        Task.objects.filter(pk=task.pk).update(
            created_at=interaction.created_at,
            updated_at=interaction.updated_at,
        )

        # Migrate zones M2M
        for iz in InteractionZone.objects.filter(interaction=interaction):
            TaskZone.objects.get_or_create(task=task, zone=iz.zone)

        # Migrate tags (GenericRelation via ContentType)
        for tag_link in TagLink.objects.filter(
            content_type=interaction_ct,
            object_id=str(interaction.pk),
        ):
            TagLink.objects.get_or_create(
                household=tag_link.household,
                tag=tag_link.tag,
                content_type=task_ct,
                object_id=str(task.pk),
                defaults={'created_by': tag_link.created_by},
            )


def reverse_migration(apps, schema_editor):
    Task = apps.get_model('tasks', 'Task')
    Task.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0001_initial_task_model'),
        ('interactions', '0012_add_occurred_at_check_constraint'),
        ('contenttypes', '0002_remove_content_type_name'),
        ('tags', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(migrate_todos_to_tasks, reverse_code=reverse_migration),
    ]
