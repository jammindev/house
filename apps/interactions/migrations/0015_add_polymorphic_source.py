"""
Replace `Interaction.stock_item` (specific FK) with a generic polymorphic source
`(source_content_type, source_object_id)` so any module can link an interaction
to its triggering object.

Order matters: add the new fields, copy data, then drop the old FK + index.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def copy_stock_item_to_source(apps, schema_editor):
    Interaction = apps.get_model('interactions', 'Interaction')
    ContentType = apps.get_model('contenttypes', 'ContentType')

    # Resolve the ContentType for stock.StockItem once
    stock_item_ct = ContentType.objects.filter(app_label='stock', model='stockitem').first()
    if stock_item_ct is None:
        return

    # All interactions that already point to a StockItem via the legacy FK
    candidates = Interaction.objects.filter(stock_item__isnull=False)
    for interaction in candidates.iterator():
        interaction.source_content_type = stock_item_ct
        interaction.source_object_id = interaction.stock_item_id
        interaction.save(update_fields=['source_content_type', 'source_object_id'])


def restore_stock_item_from_source(apps, schema_editor):
    """Reverse: only used if you migrate back. Best-effort."""
    Interaction = apps.get_model('interactions', 'Interaction')
    ContentType = apps.get_model('contenttypes', 'ContentType')

    stock_item_ct = ContentType.objects.filter(app_label='stock', model='stockitem').first()
    if stock_item_ct is None:
        return

    candidates = Interaction.objects.filter(source_content_type=stock_item_ct)
    for interaction in candidates.iterator():
        interaction.stock_item_id = interaction.source_object_id
        interaction.save(update_fields=['stock_item_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('households', '0008_household_preferred_language'),
        ('interactions', '0014_backfill_stock_purchase_subjects'),
        ('projects', '0006_rename_user_pinned_househo_ce4d75_idx_project_mem_househo_b9a7c5_idx_and_more'),
        ('zones', '0005_zone_one_root_constraint'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Add the new generic FK columns
        migrations.AddField(
            model_name='interaction',
            name='source_content_type',
            field=models.ForeignKey(
                blank=True,
                help_text='Polymorphic source: type of the object that triggered this interaction.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='contenttypes.contenttype',
            ),
        ),
        migrations.AddField(
            model_name='interaction',
            name='source_object_id',
            field=models.UUIDField(
                blank=True,
                help_text='Polymorphic source: id of the object that triggered this interaction.',
                null=True,
            ),
        ),
        # 2. Copy data from the legacy stock_item FK into the new generic columns
        migrations.RunPython(copy_stock_item_to_source, reverse_code=restore_stock_item_from_source),
        # 3. Drop the old FK + index now that data is moved
        migrations.RemoveIndex(
            model_name='interaction',
            name='idx_int_stock_item',
        ),
        migrations.RemoveField(
            model_name='interaction',
            name='stock_item',
        ),
        # 4. Index the new generic columns for query performance
        migrations.AddIndex(
            model_name='interaction',
            index=models.Index(
                fields=['source_content_type', 'source_object_id'],
                name='idx_int_source',
            ),
        ),
    ]
