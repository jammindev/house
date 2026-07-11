"""
Data migration: finish the todo → Task extraction started by tasks.0002.

That migration COPIED Interaction(type='todo') rows into Task (with a
``source_interaction`` back-pointer) but left the originals in place, so every
migrated todo has lived twice ever since: once as a Task (the living one) and
once as a journal entry polluting the activity feed and the agent's retrieval.

This migration deletes the todo interactions:
- a todo that has a Task twin is deleted outright (the Task already carries
  subject/content/due_date/completion/zones/tags — nothing is lost, the twin's
  ``source_interaction`` goes NULL via on_delete=SET_NULL);
- a todo created AFTER tasks.0002 (no twin) is first converted to a Task with
  the same field mapping as tasks.0002, then deleted.

It also clears the vestigial ``status`` values on non-todo rows (7 known rows
in dev — history of the pre-extraction era) so the column can be dropped by the
following schema migration.

Irreversible by design: the deleted rows are exact duplicates of their Task
twin, there is nothing to restore that the Task does not already hold.
"""
from datetime import date

from django.db import migrations


def _convert_orphan(apps, interaction):
    """Create the missing Task twin for a post-extraction todo (same mapping as tasks.0002)."""
    Task = apps.get_model('tasks', 'Task')
    TaskZone = apps.get_model('tasks', 'TaskZone')
    InteractionZone = apps.get_model('interactions', 'InteractionZone')

    due_date = None
    due_date_str = (interaction.metadata or {}).get('due_date')
    if due_date_str:
        try:
            due_date = date.fromisoformat(due_date_str)
        except (ValueError, TypeError):
            pass

    completed_at = None
    completed_by = None
    if interaction.status == 'done':
        completed_at = interaction.updated_at
        completed_by = interaction.updated_by or interaction.created_by

    task = Task.objects.create(
        household=interaction.household,
        subject=interaction.subject,
        content=interaction.content,
        status=interaction.status or 'pending',
        priority=2,
        due_date=due_date,
        is_private=interaction.is_private,
        source_interaction=interaction,
        completed_by=completed_by,
        completed_at=completed_at,
        created_by=interaction.created_by,
        updated_by=interaction.updated_by,
        metadata={},
    )
    for link in InteractionZone.objects.filter(interaction=interaction):
        TaskZone.objects.get_or_create(task=task, zone=link.zone)


def purge_todo_interactions(apps, schema_editor):
    Interaction = apps.get_model('interactions', 'Interaction')
    Task = apps.get_model('tasks', 'Task')

    twin_ids = set(
        Task.objects.filter(source_interaction__isnull=False).values_list(
            'source_interaction_id', flat=True
        )
    )
    for interaction in Interaction.objects.filter(type='todo').iterator():
        if interaction.id not in twin_ids:
            _convert_orphan(apps, interaction)
        interaction.delete()

    # Vestigial statuses on non-todo rows — clear before dropping the column.
    Interaction.objects.exclude(status__isnull=True).update(status=None)


class Migration(migrations.Migration):

    dependencies = [
        ('interactions', '0017_remove_interaction_project_field'),
        ('tasks', '0004_private_not_assigned_constraint'),
    ]

    operations = [
        migrations.RunPython(purge_todo_interactions, migrations.RunPython.noop),
    ]
