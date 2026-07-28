"""The allocation invariant: a bank line cannot be split for more than it holds.

This lives in its own module because it must be enforced from **two** places
that know nothing about each other:

- ``banking.services.set_allocations``, the deliberate editor;
- ``interactions.serializers.InteractionSerializer``, the generic PATCH that any
  client can aim at an expense's ``amount``.

That second one is the whole point. ``Interaction.amount`` is written by six
producers plus a plain REST update, none of which has ever heard of a bank line.
Without a shared check, editing 80 € into 500 € on a reconciled expense would
break the invariant in complete silence.

No DB constraint can express this: a ``CHECK`` is per row, never across rows —
and a dedicated ``Allocation`` table would not have made it constrainable either
(see ``docs/fiches/IMPORT_ET_RAPPROCHEMENT.md`` §5). The guarantee is therefore a
service that locks the transaction row before summing.
"""
from __future__ import annotations

from decimal import Decimal

from rest_framework.exceptions import ValidationError


def allocated_total(transaction, *, exclude_interaction_id=None) -> Decimal:
    """Sum of the expenses already allocated to ``transaction``.

    ``exclude_interaction_id`` leaves one expense out, so an edit can be checked
    against what the *others* take up rather than against its own former value.
    """
    from interactions.queries import expenses, sum_amount

    qs = expenses(base=transaction.interactions.all())
    if exclude_interaction_id is not None:
        qs = qs.exclude(pk=exclude_interaction_id)
    return sum_amount(qs)


def remaining_to_allocate(transaction, *, exclude_interaction_id=None) -> Decimal:
    """What is still free on this line — the "reste à ventiler" of the UI."""
    return transaction.outflow - allocated_total(
        transaction, exclude_interaction_id=exclude_interaction_id
    )


def assert_allocation_fits(
    *,
    transaction,
    extra_amount: Decimal = Decimal("0.00"),
    exclude_interaction_id=None,
) -> None:
    """Raise 400 unless ``extra_amount`` still fits on ``transaction``.

    ``extra_amount`` is the amount about to be written — a new allocation, or the
    new value of an existing one (in which case pass its id as
    ``exclude_interaction_id`` so its own former amount is not counted twice).
    """
    if transaction is None:
        return

    if transaction.transfer_counterpart_id is not None:
        # An internal movement is not spending: the money is counted once, later,
        # when the cash it fed is actually spent. Allocating it would double it.
        raise ValidationError(
            {"bank_transaction": "An internal movement cannot be allocated."}
        )

    if transaction.amount >= 0:
        raise ValidationError(
            {"bank_transaction": "Only an outgoing operation can be allocated."}
        )

    already = allocated_total(transaction, exclude_interaction_id=exclude_interaction_id)
    total = already + (extra_amount or Decimal("0.00"))

    if total > transaction.outflow:
        raise ValidationError(
            {
                "amount": (
                    f"Allocations would total {total} on an operation of "
                    f"{transaction.outflow}."
                )
            }
        )


# --- Le miroir, côté recette (parcours 26, ventilation des remboursements) -----


def refunded_total(transaction, *, exclude_budget_id=None) -> Decimal:
    """Somme déjà rendue aux enveloppes par cette recette."""
    from django.db.models import Sum

    qs = transaction.refund_allocations.all()
    if exclude_budget_id is not None:
        qs = qs.exclude(budget_id=exclude_budget_id)
    return qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")


def remaining_to_refund(transaction, *, exclude_budget_id=None) -> Decimal:
    """Ce qui reste à attribuer sur cette recette — le « reste » de l'éditeur."""
    return transaction.inflow - refunded_total(
        transaction, exclude_budget_id=exclude_budget_id
    )


def assert_refund_fits(*, transaction, extra_amount: Decimal = Decimal("0.00")) -> None:
    """Refuse (400) une répartition qui rendrait plus que la recette n'a apporté.

    Même raison d'être que ``assert_allocation_fits`` : aucun ``CHECK`` ne
    s'exprime en travers de plusieurs lignes, donc la garantie est un service qui
    verrouille la ligne avant de sommer. Et même conséquence si on l'oubliait :
    une enveloppe recréditée de 200 € par un virement de 70 € ferait mentir son
    plafond sans que rien ne le signale.
    """
    if transaction is None:
        return
    if transaction.inflow <= 0:
        raise ValidationError({"transaction": "Only a receipt can credit a budget back."})
    if refunded_total(transaction) + extra_amount > transaction.inflow:
        raise ValidationError(
            {
                "amount": (
                    "This refund only brought "
                    f"{transaction.inflow}; it cannot credit more than that."
                )
            }
        )
