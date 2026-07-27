"""Remonter en colonnes les montants restés dans ``metadata``.

L'ancien formulaire du journal (`InteractionNewPage`, type `expense`, retiré en
juillet 2026) écrivait `amount` et `supplier` dans `metadata`, alors que ce sont
des colonnes depuis `0023`/`0024`. Rien ne lisait plus ces clés : une dépense
saisie par ce chemin valait **0 €** dans tous les budgets et tous les totaux.

La règle vit dans `interactions.repairs`, pour être testable ailleurs qu'en
rejouant la migration.
"""
from django.db import migrations

from interactions.repairs import promote_misplaced_expense_fields


def promote(apps, schema_editor):
    stats = promote_misplaced_expense_fields(apps.get_model("interactions", "Interaction"))
    if stats["scanned"]:
        print(
            f"  interactions.0028: {stats['scanned']} dépense(s) portant des clés "
            f"déplacées — {stats['amount_promoted']} montant(s) et "
            f"{stats['supplier_promoted']} fournisseur(s) remontés en colonne, "
            f"{stats['unreadable']} illisible(s) laissé(s) tels quels."
        )


def noop(apps, schema_editor):
    # Irréversible par construction : les colonnes sont la vérité, et
    # re-matérialiser les clés JSON recréerait le double stockage qu'on supprime.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("interactions", "0027_backfill_recurring_expense"),
    ]

    operations = [
        migrations.RunPython(promote, noop),
    ]
