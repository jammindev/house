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

    unallocated = _unallocated_outflow(real)

    return {
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
        "outflow": str(outflow),
        "inflow": str(inflow),
        "net": str(inflow - outflow),
        "transaction_count": real.count(),
        "internal_count": qs.filter(is_internal=True).count(),
        # Le pont entre les deux mondes — **un ratio, jamais une somme**. Additionner
        # un total banque et un total interactions donnerait un nombre qui ne veut
        # rien dire (voir CLAUDE.md « Relevés bancaires »). Le taux de couverture dit
        # « quelle part de ce qui est sorti est expliquée », ce qui est exactement la
        # question à laquelle le contrôle de conformité répond ligne par ligne.
        "unallocated_outflow": str(unallocated),
        "coverage_ratio": _coverage_ratio(outflow, unallocated),
    }


def _unallocated_outflow(qs) -> Decimal:
    """Part des sorties qu'aucune dépense n'explique, sur ``qs``.

    Calculée par différence sur la **même** requête que les totaux, et non par une
    somme de dépenses : mélanger les deux sources est précisément ce que la règle
    transverse interdit.
    """
    from django.db.models import Q, Sum
    from django.db.models.functions import Coalesce

    from .queries import ZERO, outflow_expr

    rows = qs.filter(amount__lt=0).annotate(
        allocated=Coalesce(
            Sum("interactions__amount", filter=Q(interactions__type="expense")),
            ZERO,
        ),
        outflow_value=outflow_expr(),
    )
    total = Decimal("0.00")
    for row in rows.values("allocated", "outflow_value"):
        gap = row["outflow_value"] - row["allocated"]
        if gap > 0:
            total += gap
    return total.quantize(Decimal("0.01"))


def _coverage_ratio(outflow: Decimal, unallocated: Decimal) -> float:
    """Part expliquée des sorties, entre 0 et 1. ``1.0`` quand rien n'est sorti.

    Rien sorti = rien à expliquer = couverture parfaite. Renvoyer 0 dirait
    « personne n'a rien rangé », ce qui serait un reproche adressé à tort.
    """
    if outflow <= 0:
        return 1.0
    covered = (outflow - unallocated) / outflow
    return float(round(max(Decimal("0"), min(Decimal("1"), covered)), 4))


EMPTY_FLOW = {
    "date_from": None,
    "date_to": None,
    "outflow": str(Decimal("0.00")),
    "inflow": str(Decimal("0.00")),
    "net": str(Decimal("0.00")),
    "transaction_count": 0,
    "internal_count": 0,
    "unallocated_outflow": str(Decimal("0.00")),
    "coverage_ratio": 1.0,
}
