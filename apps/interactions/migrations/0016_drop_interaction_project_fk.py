"""
Step 1/2 of dropping `Interaction.project` (see #131): copy the legacy FK into
the generic polymorphic source `(source_content_type, source_object_id)` — the
same link stock and equipment already use (see 0015).

Only rows without a source are touched: a dialog-created purchase already
carries its source. The FK + index drop lives in 0017 — same transaction would
fail on Postgres ("pending trigger events": the row updates fire deferred FK
triggers that must commit before the ALTER TABLE).
"""
from django.db import migrations


def copy_project_to_source(apps, schema_editor):
    Interaction = apps.get_model('interactions', 'Interaction')
    ContentType = apps.get_model('contenttypes', 'ContentType')

    # Resolve the ContentType for projects.Project once
    project_ct = ContentType.objects.filter(app_label='projects', model='project').first()
    if project_ct is None:
        return

    # Interactions linked via the legacy FK that have no polymorphic source yet
    candidates = Interaction.objects.filter(
        project__isnull=False,
        source_content_type__isnull=True,
    )
    for interaction in candidates.iterator():
        interaction.source_content_type = project_ct
        interaction.source_object_id = interaction.project_id
        interaction.save(update_fields=['source_content_type', 'source_object_id'])


def restore_project_from_source(apps, schema_editor):
    """Reverse: only used if you migrate back. Best-effort."""
    Interaction = apps.get_model('interactions', 'Interaction')
    ContentType = apps.get_model('contenttypes', 'ContentType')

    project_ct = ContentType.objects.filter(app_label='projects', model='project').first()
    if project_ct is None:
        return

    candidates = Interaction.objects.filter(source_content_type=project_ct)
    for interaction in candidates.iterator():
        interaction.project_id = interaction.source_object_id
        interaction.save(update_fields=['project_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('interactions', '0015_add_polymorphic_source'),
    ]

    operations = [
        migrations.RunPython(copy_project_to_source, reverse_code=restore_project_from_source),
    ]
