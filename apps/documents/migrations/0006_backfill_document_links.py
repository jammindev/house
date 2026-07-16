"""Backfill DocumentLink from the 5 legacy per-model through tables.

Copies every ZoneDocument / InteractionDocument / ProjectDocument /
EquipmentDocument / TaskDocument row into the polymorphic DocumentLink table.
Idempotent (skips rows already linked) and reversible (reverse deletes the
backfilled links). The legacy tables are kept — they are dropped in a later
migration once the new mechanism is validated in production.
"""
from django.db import migrations


# (app_label, through_model, parent_fk_attr, role_default_or_None)
THROUGH_TABLES = [
    ("zones", "ZoneDocument", "zone", None),
    ("interactions", "InteractionDocument", "interaction", None),
    ("projects", "ProjectDocument", "project", None),
    ("equipment", "EquipmentDocument", "equipment", None),
    ("tasks", "TaskDocument", "task", "document"),  # TaskDocument has no role field
]


def backfill(apps, schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    DocumentLink = apps.get_model("documents", "DocumentLink")

    for app_label, model_name, parent_attr, role_default in THROUGH_TABLES:
        Through = apps.get_model(app_label, model_name)
        parent_model = Through._meta.get_field(parent_attr).related_model
        ct = ContentType.objects.get_for_model(parent_model)

        for row in Through.objects.all().iterator():
            object_id = getattr(row, f"{parent_attr}_id")
            role = role_default if role_default is not None else getattr(row, "role", "document")
            _, created = DocumentLink.objects.get_or_create(
                content_type=ct,
                object_id=object_id,
                document_id=row.document_id,
                defaults={
                    "role": role or "document",
                    "note": getattr(row, "note", "") or "",
                    "created_by_id": getattr(row, "created_by_id", None),
                },
            )
            # Preserve the original created_at (auto_now_add overrides it on create).
            if created:
                DocumentLink.objects.filter(
                    content_type=ct, object_id=object_id, document_id=row.document_id
                ).update(created_at=row.created_at)


def unbackfill(apps, schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    DocumentLink = apps.get_model("documents", "DocumentLink")

    for app_label, model_name, parent_attr, _role in THROUGH_TABLES:
        Through = apps.get_model(app_label, model_name)
        parent_model = Through._meta.get_field(parent_attr).related_model
        ct = ContentType.objects.get_for_model(parent_model)
        for row in Through.objects.all().iterator():
            object_id = getattr(row, f"{parent_attr}_id")
            DocumentLink.objects.filter(
                content_type=ct, object_id=object_id, document_id=row.document_id
            ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0005_documentlink"),
        ("zones", "0005_zone_one_root_constraint"),
        ("interactions", "0019_remove_interaction_interactions_type_check_and_more"),
        ("projects", "0007_remove_projectaithread_household_and_more"),
        ("equipment", "0004_equipmentdocument"),
        ("tasks", "0005_task_needs_dry_weather"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
