"""Banking aggregates — the "bank" view of the money.

**These totals are never added to the expense totals.** ``interactions`` answers
"what did the household spend it on"; this module answers "what actually left the
account". Both are true, they differ until everything is allocated, and that gap
is the useful signal — surfaced as a coverage ratio in lot 7, never as a sum.
See CLAUDE.md « Relevés bancaires » and ``docs/fiches/CARTOGRAPHIE_DEPENSES.md``.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from .queries import spendable, sum_inflow, sum_outflow, transactions


def compute_account_flow(
    *,
    household,
    account=None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    """Money in and out over a period, for one account or the whole household.

    Internal movements are counted separately and excluded from both totals: an
    ATM withdrawal is not spending, it is cash changing pocket, and the money is
    counted again when that cash is spent.

    ``net`` is deliberately ``inflow - outflow`` over *spendable* lines only, so
    it answers "did the household earn more than it spent" rather than "how did
    the balance move" — the balance is lot 4's job, and it is anchored on the
    bank's own figure rather than recomputed from a sum.
    """
    qs = transactions(household_id=household.id)
    if account is not None:
        qs = qs.filter(account=account)
    if date_from is not None:
        qs = qs.filter(booked_on__gte=date_from)
    if date_to is not None:
        qs = qs.filter(booked_on__lte=date_to)

    real = spendable(qs)
    outflow = sum_outflow(real)
    inflow = sum_inflow(real)

    return {
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
        "outflow": str(outflow),
        "inflow": str(inflow),
        "net": str(inflow - outflow),
        "transaction_count": real.count(),
        "internal_count": qs.filter(is_internal=True).count(),
    }


EMPTY_FLOW = {
    "date_from": None,
    "date_to": None,
    "outflow": str(Decimal("0.00")),
    "inflow": str(Decimal("0.00")),
    "net": str(Decimal("0.00")),
    "transaction_count": 0,
    "internal_count": 0,
}
