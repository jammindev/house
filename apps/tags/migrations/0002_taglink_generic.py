import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def migrate_interaction_tags_to_tag_links(apps, schema_editor):
    InteractionTag = apps.get_model("tags", "InteractionTag")
    TagLink = apps.get_model("tags", "TagLink")
    ContentType = apps.get_model("contenttypes", "ContentType")

    interaction_ct = ContentType.objects.get(app_label="interactions", model="interaction")

    links_to_create = []
    for item in InteractionTag.objects.select_related("interaction", "tag").iterator():
        links_to_create.append(
            TagLink(
                id=uuid.uuid4(),
                household_id=item.interaction.household_id,
                tag_id=item.tag_id,
                content_type_id=interaction_ct.id,
                object_id=str(item.interaction_id),
                created_at=item.created_at,
                updated_at=item.created_at,
                created_by_id=item.created_by_id,
                updated_by_id=item.created_by_id,
            )
        )

    if links_to_create:
        TagLink.objects.bulk_create(links_to_create, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ("contenttypes", "0002_remove_content_type_name"),
        ("households", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tags", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TagLink",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("object_id", models.CharField(max_length=64)),
                ("content_type", models.ForeignKey(db_column="content_type_id", on_delete=django.db.models.deletion.CASCADE, related_name="tag_links", to="contenttypes.contenttype")),
                ("created_by", models.ForeignKey(blank=True, db_column="created_by", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_created", to=settings.AUTH_USER_MODEL)),
                ("household", models.ForeignKey(db_column="household_id", on_delete=django.db.models.deletion.CASCADE, related_name="%(class)s_set", to="households.household")),
                ("tag", models.ForeignKey(db_column="tag_id", on_delete=django.db.models.deletion.CASCADE, related_name="links", to="tags.tag")),
                ("updated_by", models.ForeignKey(blank=True, db_column="updated_by", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_updated", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "tag_links",
                "unique_together": {("household", "tag", "content_type", "object_id")},
            },
        ),
        migrations.AddIndex(
            model_name="taglink",
            index=models.Index(fields=["household", "tag"], name="idx_tlink_hh_tag"),
        ),
        migrations.AddIndex(
            model_name="taglink",
            index=models.Index(fields=["content_type", "object_id"], name="idx_tlink_object"),
        ),
        migrations.AddIndex(
            model_name="taglink",
            index=models.Index(fields=["household", "content_type"], name="idx_tlink_hh_ct"),
        ),
        migrations.RunPython(
            migrate_interaction_tags_to_tag_links,
            migrations.RunPython.noop,
        ),
    ]
