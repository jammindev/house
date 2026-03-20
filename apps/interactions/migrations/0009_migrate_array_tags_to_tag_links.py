import uuid

from django.db import migrations


def migrate_array_tags_to_tag_links(apps, schema_editor):
    Interaction = apps.get_model("interactions", "Interaction")
    Tag = apps.get_model("tags", "Tag")
    TagLink = apps.get_model("tags", "TagLink")
    ContentType = apps.get_model("contenttypes", "ContentType")

    if not Interaction.objects.exists():
        return

    try:
        interaction_ct = ContentType.objects.get(app_label="interactions", model="interaction")
    except ContentType.DoesNotExist:
        return

    for interaction in Interaction.objects.all().iterator():
        raw_tags = interaction.tags or []
        normalized_names = []
        for name in raw_tags:
            clean_name = (name or "").strip()
            if clean_name and clean_name not in normalized_names:
                normalized_names.append(clean_name)

        for tag_name in normalized_names:
            tag, _ = Tag.objects.get_or_create(
                household_id=interaction.household_id,
                type="interaction",
                name=tag_name,
                defaults={
                    "id": uuid.uuid4(),
                    "created_by_id": interaction.created_by_id,
                    "updated_by_id": interaction.updated_by_id,
                },
            )
            TagLink.objects.get_or_create(
                household_id=interaction.household_id,
                tag_id=tag.id,
                content_type_id=interaction_ct.id,
                object_id=str(interaction.id),
                defaults={
                    "id": uuid.uuid4(),
                    "created_by_id": interaction.created_by_id,
                    "updated_by_id": interaction.updated_by_id,
                },
            )


class Migration(migrations.Migration):

    dependencies = [
        ("interactions", "0008_interaction_is_private"),
        ("tags", "0002_taglink_generic"),
    ]

    operations = [
        migrations.RunPython(
            migrate_array_tags_to_tag_links,
            migrations.RunPython.noop,
        ),
        migrations.RemoveField(
            model_name="interaction",
            name="tags",
        ),
    ]
