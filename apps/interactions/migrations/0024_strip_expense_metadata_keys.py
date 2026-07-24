"""Strip the now-redundant amount/kind/supplier keys from expense metadata.

Since PR « expense columns » these three fields are real columns on Interaction
(backfilled by 0023) and every reader + the frontend use them. This migration
removes the duplicated keys from ``metadata`` on expense interactions so the JSON
carries only what stays there (source_name, unit_price, and feature extras like
delta/unit/brand/recurring_id). Renovation entries (``type != 'expense'``) are
left untouched — their ``metadata.kind == 'renovation'`` discriminator is not a
column. See docs/fiches/CARTOGRAPHIE_DEPENSES.md.
"""
from django.db import migrations

STRIPPED_KEYS = ("amount", "kind", "supplier")


def strip(apps, schema_editor):
    Interaction = apps.get_model("interactions", "Interaction")
    batch = []
    for it in Interaction.objects.filter(type="expense").iterator():
        meta = it.metadata or {}
        if not any(k in meta for k in STRIPPED_KEYS):
            continue
        for k in STRIPPED_KEYS:
            meta.pop(k, None)
        it.metadata = meta
        batch.append(it)
        if len(batch) >= 500:
            Interaction.objects.bulk_update(batch, ["metadata"])
            batch = []
    if batch:
        Interaction.objects.bulk_update(batch, ["metadata"])


def noop(apps, schema_editor):
    # Reverse is a no-op: the columns remain the source of truth; re-materializing
    # the metadata keys is unnecessary (nothing reads them anymore).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("interactions", "0023_backfill_expense_columns"),
    ]

    operations = [
        migrations.RunPython(strip, noop),
    ]
