"""Réparations de données ponctuelles, testables hors migration.

Une migration de données qui contient sa propre logique ne se teste qu'en la
rejouant. En la sortant ici, la règle se teste comme n'importe quel service, et
la migration n'est plus qu'un appel.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

#: Clés que l'ancien formulaire du journal écrivait dans ``metadata`` alors que
#: ce sont des colonnes depuis ``interactions.0023`` / ``0024``.
_MISPLACED = ("amount", "supplier")


def promote_misplaced_expense_fields(Interaction) -> dict[str, int]:
    """Remonter en colonnes le montant et le fournisseur restés dans ``metadata``.

    ``InteractionNewPage`` a écrit ``metadata.amount`` / ``metadata.supplier``
    jusqu'en juillet 2026, alors que ces champs sont des colonnes depuis la
    promotion documentée dans ``CARTOGRAPHIE_DEPENSES.md``. Rien ne lisait plus
    ces clés : une dépense saisie par ce chemin valait **0 €** dans tous les
    budgets, tous les totaux et tous les bilans, sans que rien ne le signale.

    Trois précautions :

    - **la colonne gagne toujours.** Si ``amount`` est déjà renseignée, la clé
      JSON est un résidu de l'ancien double stockage, pas une correction en
      attente — on la retire sans rien réécrire ;
    - **une valeur illisible est laissée telle quelle** plutôt que forcée à
      zéro : un montant faux est pire qu'un montant absent, qui lui se voit ;
    - **les clés sont retirées dans tous les cas**, comme l'a fait ``0024`` :
      les laisser garderait vivante la source du malentendu.

    Renvoie le compte de ce qui a été fait, pour que le journal de déploiement
    dise ce qui s'est passé plutôt que de rester muet.
    """
    stats = {"scanned": 0, "amount_promoted": 0, "supplier_promoted": 0, "unreadable": 0}
    batch = []

    for expense in Interaction.objects.filter(type="expense").iterator():
        meta = expense.metadata or {}
        if not any(key in meta for key in _MISPLACED):
            continue

        stats["scanned"] += 1

        raw_amount = meta.pop("amount", None)
        if expense.amount is None and raw_amount not in (None, ""):
            try:
                expense.amount = Decimal(str(raw_amount))
                stats["amount_promoted"] += 1
            except (InvalidOperation, TypeError, ValueError):
                stats["unreadable"] += 1

        raw_supplier = meta.pop("supplier", None)
        if not expense.supplier and raw_supplier:
            expense.supplier = str(raw_supplier)[:255]
            stats["supplier_promoted"] += 1

        # L'écriture n'est pas conditionnée à une promotion : même quand la
        # colonne gagnait déjà, les clés retirées doivent être persistées.
        expense.metadata = meta
        batch.append(expense)

        if len(batch) >= 500:
            Interaction.objects.bulk_update(batch, ["amount", "supplier", "metadata"])
            batch = []

    if batch:
        Interaction.objects.bulk_update(batch, ["amount", "supplier", "metadata"])

    return stats
