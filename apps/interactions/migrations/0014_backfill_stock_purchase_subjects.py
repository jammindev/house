"""
Backfill auto-generated subjects for stock_purchase interactions.

Until now, the auto-subject was a hardcoded English string ("Purchase: <name>")
without a discriminator. We're moving to a write-time gettext pattern that
renders the subject in the creator's locale and tags the interaction with
metadata.kind = "stock_purchase".

This migration retroactively localizes existing rows using the creator's
locale (fallback: 'en') and adds the kind / stock_item_name metadata.
"""
from django.db import migrations
from django.utils import translation


OLD_PREFIX = "Purchase: "


def backfill(apps, schema_editor):
    Interaction = apps.get_model("interactions", "Interaction")
    StockItem = apps.get_model("stock", "StockItem")

    candidates = Interaction.objects.filter(
        stock_item__isnull=False,
        subject__startswith=OLD_PREFIX,
    ).select_related("created_by")

    for interaction in candidates:
        stock_item = StockItem.objects.filter(pk=interaction.stock_item_id).first()
        if not stock_item:
            continue

        creator_locale = getattr(interaction.created_by, "locale", None) or "en"
        with translation.override(creator_locale):
            from django.utils.translation import gettext as _

            interaction.subject = _("Purchase — {name}").format(name=stock_item.name)

        metadata = dict(interaction.metadata or {})
        metadata.setdefault("kind", "stock_purchase")
        metadata.setdefault("stock_item_name", stock_item.name)
        interaction.metadata = metadata
        interaction.save(update_fields=["subject", "metadata"])


def noop(apps, schema_editor):
    """Reverse is intentionally a no-op: we don't restore the old English string."""


class Migration(migrations.Migration):
    dependencies = [
        ("interactions", "0013_interaction_stock_item_and_more"),
        ("stock", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(backfill, reverse_code=noop),
    ]
