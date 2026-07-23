"""
Budget overview aggregation.

Computes, for the current calendar month (in the household's timezone), how much
each budget has spent versus its ceiling, plus the "hors budget" total and the
optional global cap. Spending is read live from the interactions journal
(``Interaction(type='expense')``, amount in ``metadata.amount``), never
denormalized — same casting convention as ``interactions.aggregations``.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import DecimalField, Sum
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce
from django.utils import timezone

from interactions.models import Interaction

from .models import Budget, RecurringExpense

# Ratio at which a budget flips to the "attention" state (below the 100% overrun).
WARNING_RATIO = getattr(settings, "BUDGET_WARNING_RATIO", 0.8)


def _zero() -> Decimal:
    return Decimal("0.00")


def _str(amount: Decimal | None) -> str:
    return str(amount if amount is not None else _zero())


def current_month_range(household) -> tuple[datetime, datetime, str]:
    """Return (start, end_exclusive, 'YYYY-MM') for the household's current month.

    The month boundary follows the household's IANA timezone so the counters
    roll over at local midnight on the 1st, not UTC. ``occurred_at`` is stored
    timezone-aware, so the aware local bounds filter correctly.
    """
    tz_name = getattr(household, "timezone", "") or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:  # pragma: no cover - defensive against a bad tz string
        tz = ZoneInfo("UTC")

    now_local = timezone.now().astimezone(tz)
    start = datetime(now_local.year, now_local.month, 1, tzinfo=tz)
    if now_local.month == 12:
        end = datetime(now_local.year + 1, 1, 1, tzinfo=tz)
    else:
        end = datetime(now_local.year, now_local.month + 1, 1, tzinfo=tz)
    return start, end, f"{now_local.year:04d}-{now_local.month:02d}"


def _spent_by_budget(household_id, start, end) -> dict:
    """SUM of expense amounts for the month, grouped by ``budget_id`` (None = hors budget)."""
    rows = (
        Interaction.objects.filter(
            household_id=household_id,
            type="expense",
            occurred_at__gte=start,
            occurred_at__lt=end,
        )
        .annotate(
            amount_decimal=Cast(
                KeyTextTransform("amount", "metadata"),
                DecimalField(max_digits=14, decimal_places=2),
            )
        )
        .values("budget_id")
        .annotate(total=Coalesce(Sum("amount_decimal"), _zero()))
    )
    return {row["budget_id"]: row["total"] or _zero() for row in rows}


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


def _state(spent: Decimal, ceiling: Decimal) -> tuple[float, str]:
    """Return (ratio, state) where state is 'ok' | 'warning' | 'over'."""
    if ceiling <= 0:
        return 0.0, "ok"
    ratio = float(spent / ceiling)
    if ratio >= 1.0:
        return ratio, "over"
    if ratio >= WARNING_RATIO:
        return ratio, "warning"
    return ratio, "ok"


def _budget_row(budget: Budget, spent: Decimal, committed: Decimal | None = None) -> dict[str, Any]:
    ratio, state = _state(spent, budget.monthly_amount)
    return {
        "id": str(budget.id),
        "name": budget.name,
        "amount": _str(budget.monthly_amount),
        "spent": _str(spent),
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
          "budgets": [{id, name, amount, spent, ratio, state}, ...],
          "unbudgeted": "700.00",
          "total_spent": "1850.00",
          "named_total_amount": "1400.00",
          "named_exceeds_global": false
        }
    """
    start, end, month = current_month_range(household)
    spent_map = _spent_by_budget(household.id, start, end)
    committed_map = _committed_by_budget(household.id, start, end)

    budgets = list(Budget.objects.filter(household_id=household.id))
    named = [b for b in budgets if not b.is_global]
    global_budget = next((b for b in budgets if b.is_global), None)

    total_spent = sum(spent_map.values(), _zero())
    total_committed = sum(committed_map.values(), _zero())
    unbudgeted = spent_map.get(None, _zero())

    named_rows = [
        _budget_row(b, spent_map.get(b.id, _zero()), committed_map.get(b.id, _zero()))
        for b in named
    ]
    named_total_amount = sum((b.monthly_amount for b in named), _zero())

    global_row = None
    named_exceeds_global = False
    if global_budget is not None:
        global_row = _budget_row(global_budget, total_spent, total_committed)
        named_exceeds_global = named_total_amount > global_budget.monthly_amount

    return {
        "month": month,
        "global": global_row,
        "budgets": named_rows,
        "unbudgeted": _str(unbudgeted),
        "total_spent": _str(total_spent),
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
        tz_name = getattr(household, "timezone", "") or "UTC"
        try:
            tz = ZoneInfo(tz_name)
        except Exception:  # pragma: no cover
            tz = ZoneInfo("UTC")
        today = timezone.now().astimezone(tz).date()

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
