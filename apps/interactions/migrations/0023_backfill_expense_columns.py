"""Backfill the promoted expense columns from ``metadata`` (parcours: expense columns).

Copies ``metadata.amount`` / ``metadata.kind`` / ``metadata.supplier`` into the
new ``amount`` / ``kind`` / ``supplier`` columns for every existing expense
interaction. Non-destructive: the metadata keys are left in place (readers now
use the columns; the metadata is stripped in a later cleanup once every consumer
— including the frontend — has moved off it). See docs/fiches/CARTOGRAPHIE_DEPENSES.md.
"""
from decimal import Decimal, InvalidOperation

from django.db import migrations


def backfill(apps, schema_editor):
    Interaction = apps.get_model("interactions", "Interaction")
    batch = []
    for it in Interaction.objects.filter(type="expense").iterator():
        meta = it.metadata or {}
        raw_amount = meta.get("amount")
        if raw_amount not in (None, ""):
            try:
                it.amount = Decimal(str(raw_amount))
            except (InvalidOperation, ValueError):
                it.amount = None
        it.kind = meta.get("kind") or ""
        it.supplier = meta.get("supplier") or ""
        batch.append(it)
        if len(batch) >= 500:
            Interaction.objects.bulk_update(batch, ["amount", "kind", "supplier"])
            batch = []
    if batch:
        Interaction.objects.bulk_update(batch, ["amount", "kind", "supplier"])


def noop(apps, schema_editor):
    # Reverse is a no-op: the columns are dropped by 0022's reverse anyway, and
    # metadata was never mutated, so there is nothing to restore.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("interactions", "0022_interaction_amount_interaction_kind_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
