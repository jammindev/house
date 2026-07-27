"""
Budget overview aggregation.

Computes, for the current calendar month (in the household's timezone), how much
each budget has spent versus its ceiling, plus the "hors budget" total and the
optional global cap. Spending is read live from the interactions journal
(``Interaction(type='expense')``, ``amount`` column), never denormalized —
via the shared ``interactions.queries`` helpers.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

from core.timezones import current_month_range as _current_month_range
from core.timezones import household_today
from interactions.queries import expenses

from .models import Budget, RecurringExpense

# Ratio at which a budget flips to the "attention" state (below the 100% overrun).
WARNING_RATIO = getattr(settings, "BUDGET_WARNING_RATIO", 0.8)


def _zero() -> Decimal:
    return Decimal("0.00")


def _str(amount: Decimal | None) -> str:
    return str(amount if amount is not None else _zero())


def current_month_range(household) -> tuple[datetime, datetime, str]:
    """``(début, fin_exclusive, 'YYYY-MM')`` du mois en cours chez le foyer.

    Alias de ``core.timezones.current_month_range``, conservé parce que c'est le
    nom sous lequel le module est importé ailleurs. La définition, elle, est
    unique : le résumé des dépenses la lit aussi, et c'est ce qui garantit que le
    compteur d'une enveloppe et la page qui l'ouvre bornent le même mois.
    """
    return _current_month_range(household)


def _spent_by_budget(household_id, start, end) -> tuple[dict, dict]:
    """``(total, attesté)`` par ``budget_id`` (``None`` = hors budget).

    Deux chiffres, **une** requête : le total du mois, et la part que le relevé
    a vue (``bank_transaction`` non nul). Le premier ne change pas — c'est lui
    que le plafond mesure, et il est lu par sept agrégations qu'on ne réécrit
    pas. Le second dit seulement *ce qu'on peut prouver*.

    Pourquoi pas un filtre dur sur les rapprochées : une dépense saisie
    aujourd'hui, avant l'import du relevé de fin de mois, est parfaitement réelle.
    L'exclure ferait baisser le compteur au fil du mois puis remonter à l'import —
    un plafond qui recule est pire qu'un plafond incertain. On affiche donc le
    même total, et **à côté** ce qui reste à attester.
    """
    rows = (
        expenses(household_id=household_id)
        .filter(occurred_at__gte=start, occurred_at__lt=end)
        .values("budget_id")
        .annotate(
            total=Coalesce(Sum("amount"), _zero()),
            attested=Coalesce(
                Sum("amount", filter=Q(bank_transaction__isnull=False)), _zero()
            ),
        )
    )
    spent, attested = {}, {}
    for row in rows:
        spent[row["budget_id"]] = row["total"] or _zero()
        attested[row["budget_id"]] = row["attested"] or _zero()
    return spent, attested


def _refunded_by_budget(household_id, start, end) -> dict:
    """Ce que le mois a **rendu** à chaque enveloppe, par ``budget_id``.

    Un article retourné, une cotisation bancaire remboursée : l'enveloppe n'a pas
    consommé cet argent. Sans ce chiffre, « 150 € / 400 € » reste faux pour
    toujours sur un achat dont 40 € sont revenus.

    ⚠️ **C'est la seule soustraction entre le monde bancaire et le journal**, et
    elle est étroite par construction : pas un total « banque » retranché d'un
    total « interactions » — ce que la règle du projet interdit, parce que les
    deux ne couvrent pas le même périmètre — mais la somme de lignes que
    l'utilisateur a **désignées une par une** comme créditant cette enveloppe.
    Une ligne sans ``refund_budget`` ne retire rien à personne.

    Le remboursement compte dans **son** mois, jamais dans celui de l'achat :
    l'imputer rétroactivement réécrirait un bilan mensuel déjà figé, que le rendu
    et le digest relisent. Conséquence assumée : un mois peut être net négatif si
    on s'est fait rembourser plus qu'on n'a dépensé. C'est un fait, pas un bug.
    """
    from banking.models import BankTransaction, InflowNature, TransactionDirection

    rows = (
        BankTransaction.objects.filter(
            household_id=household_id,
            direction=TransactionDirection.IN,
            inflow_nature=InflowNature.REFUND,
            refund_budget__isnull=False,
            booked_on__gte=start.date(),
            booked_on__lt=end.date(),
        )
        .values("refund_budget_id")
        .annotate(total=Coalesce(Sum("amount"), _zero()))
    )
    # ``amount`` est signé et une recette est positive : rien à inverser ici.
    return {row["refund_budget_id"]: row["total"] or _zero() for row in rows}


def _committed_by_budget(household_id, start, end) -> dict:
    """Sum of recurring-expense amounts DUE this month, grouped by ``budget_id``.

    'Engagé à venir' — occurrences scheduled for the current month that have not
    been confirmed yet (confirming advances ``next_due_date`` out of the month).
    ``None`` key = recurrences not attached to any budget.
    """
    rows = (
        RecurringExpense.objects.filter(
            household_id=household_id,
            next_due_date__gte=start.date(),
            next_due_date__lt=end.date(),
        )
        .values("budget_id")
        .annotate(total=Coalesce(Sum("amount"), _zero()))
    )
    return {row["budget_id"]: row["total"] or _zero() for row in rows}


def _state(spent: Decimal, ceiling: Decimal | None) -> tuple[float, str]:
    """Return (ratio, state) — 'uncapped' | 'ok' | 'warning' | 'over'.

    ``uncapped`` is its own state, never 'ok': a category with no ceiling cannot
    be respected or exceeded, and rendering it as 'ok' would put a green bar at
    0 % on something that has no scale. Same reasoning as the conformity window —
    « rien à signaler » et « rien à mesurer » ne sont pas le même zéro.
    """
    if ceiling is None:
        return 0.0, "uncapped"
    if ceiling <= 0:
        return 0.0, "ok"
    ratio = float(spent / ceiling)
    if ratio >= 1.0:
        return ratio, "over"
    if ratio >= WARNING_RATIO:
        return ratio, "warning"
    return ratio, "ok"


def _budget_row(
    budget: Budget,
    spent: Decimal,
    committed: Decimal | None = None,
    attested: Decimal | None = None,
    refunded: Decimal | None = None,
) -> dict[str, Any]:
    seen = attested if attested is not None else _zero()
    given_back = refunded if refunded is not None else _zero()
    net = spent - given_back
    # C'est le **net** que le plafond mesure : de l'argent rendu n'a pas été
    # dépensé. Mesurer le brut laisserait « 150 € / 400 € » sur un achat dont
    # 40 € sont revenus, c'est-à-dire un plafond qu'on atteint plus vite que la
    # réalité — l'inverse du service rendu.
    ratio, state = _state(net, budget.monthly_amount)
    return {
        "id": str(budget.id),
        "name": budget.name,
        # ``None``, never "0.00": stringified, a missing ceiling and a ceiling of
        # zero read the same — and the second one is permanently over budget.
        "amount": None if budget.monthly_amount is None else _str(budget.monthly_amount),
        # ``spent`` reste le **brut** : sept agrégations le lisent, et le
        # décomposer en attesté/en attente n'aurait plus de sens s'il changeait de
        # définition. Le net est un chiffre de plus, pas une redéfinition.
        "spent": _str(spent),
        # Deux chiffres **additionnels** : ``spent_attested`` est ce qu'une ligne
        # de relevé justifie, ``spent_pending`` le reste. Leur somme vaut
        # ``spent``, toujours.
        "spent_attested": _str(seen),
        "spent_pending": _str(spent - seen),
        "refunded": _str(given_back),
        "net_spent": _str(net),
        "committed": _str(committed if committed is not None else _zero()),
        "ratio": round(ratio, 4),
        "state": state,
    }


def compute_budget_overview(*, household) -> dict[str, Any]:
    """Return the month's budget overview for a household.

    Shape::

        {
          "month": "2026-07",
          "global": {id, name, amount, spent, ratio, state} | null,
          "budgets": [{id, name, amount, spent, spent_attested, spent_pending,
                       refunded, net_spent, committed, ratio, state}, ...],
          "unbudgeted": "700.00",
          "total_spent": "1850.00",
          "total_attested": "1600.00",
          "total_pending": "250.00",
          "total_refunded": "40.00",
          "total_net_spent": "1810.00",
          "named_total_amount": "1400.00",
          "named_exceeds_global": false
        }

    ``spent_attested + spent_pending == spent``, par construction : le second est
    calculé par différence. Deux sommes indépendantes finiraient par se contredire
    d'un centime d'arrondi, et un total qui ne se recompose pas ne se lit pas.

    ``net_spent == spent - refunded``, et c'est **le net que ``ratio``/``state``
    mesurent** : de l'argent rendu n'a pas été dépensé. ``spent`` garde sa
    définition brute — sept agrégations le lisent, et sa décomposition
    attesté/en attente perdrait son sens s'il changeait.
    """
    start, end, month = current_month_range(household)
    spent_map, attested_map = _spent_by_budget(household.id, start, end)
    committed_map = _committed_by_budget(household.id, start, end)
    refunded_map = _refunded_by_budget(household.id, start, end)

    budgets = list(Budget.objects.filter(household_id=household.id))
    named = [b for b in budgets if not b.is_global]
    global_budget = next((b for b in budgets if b.is_global), None)

    total_spent = sum(spent_map.values(), _zero())
    total_attested = sum(attested_map.values(), _zero())
    total_committed = sum(committed_map.values(), _zero())
    total_refunded = sum(refunded_map.values(), _zero())
    unbudgeted = spent_map.get(None, _zero())

    named_rows = [
        _budget_row(
            b,
            spent_map.get(b.id, _zero()),
            committed_map.get(b.id, _zero()),
            attested_map.get(b.id, _zero()),
            refunded_map.get(b.id, _zero()),
        )
        for b in named
    ]
    # Only the capped ones: an uncapped category promises nothing, so it cannot
    # make the envelopes overshoot the global ceiling on paper.
    named_total_amount = sum(
        (b.monthly_amount for b in named if b.monthly_amount is not None), _zero()
    )

    global_row = None
    named_exceeds_global = False
    if global_budget is not None:
        global_row = _budget_row(
            global_budget, total_spent, total_committed, total_attested, total_refunded
        )
        named_exceeds_global = (
            global_budget.monthly_amount is not None
            and named_total_amount > global_budget.monthly_amount
        )

    return {
        "month": month,
        "global": global_row,
        "budgets": named_rows,
        "unbudgeted": _str(unbudgeted),
        "total_spent": _str(total_spent),
        "total_attested": _str(total_attested),
        "total_pending": _str(total_spent - total_attested),
        "total_refunded": _str(total_refunded),
        "total_net_spent": _str(total_spent - total_refunded),
        "total_committed": _str(total_committed),
        "named_total_amount": _str(named_total_amount),
        "named_exceeds_global": named_exceeds_global,
    }


def compute_cashflow_projection(*, household, today=None, horizons=(30, 90)) -> dict[str, Any]:
    """Project upcoming recurring outflows over the next N days.

    For each horizon, sums every recurring occurrence whose date falls in
    ``[today, today + N days]`` — stepping each recurrence by its cadence so a
    monthly bill counts ~3× over 90 days. Read-only; no state advanced.

    Shape::

        {
          "today": "2026-07-23",
          "horizons": [{"days": 30, "total": "142.00", "count": 3},
                       {"days": 90, "total": "426.00", "count": 7}],
        }
    """
    from datetime import timedelta

    from .services import advance_due_date

    if today is None:
        today = household_today(household)

    recurrences = list(RecurringExpense.objects.filter(household_id=household.id))
    max_horizon = max(horizons) if horizons else 0
    far_end = today + timedelta(days=max_horizon)

    # Pre-expand each recurrence's occurrences up to the farthest horizon once.
    occurrences: list[tuple] = []  # (date, amount)
    for rec in recurrences:
        due = rec.next_due_date
        # skip occurrences already in the past relative to today
        while due < today:
            due = advance_due_date(due, rec.cadence)
        while due <= far_end:
            occurrences.append((due, rec.amount))
            due = advance_due_date(due, rec.cadence)

    horizon_rows = []
    for days in horizons:
        limit = today + timedelta(days=days)
        due_in_window = [amount for (d, amount) in occurrences if d <= limit]
        horizon_rows.append(
            {
                "days": days,
                "total": _str(sum(due_in_window, _zero())),
                "count": len(due_in_window),
            }
        )

    return {"today": today.isoformat(), "horizons": horizon_rows}
