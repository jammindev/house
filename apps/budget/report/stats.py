"""
Monthly budget report — numeric snapshot (parcours 21 lot 3).

Computes the frozen figures for one closed month: spend vs each budget, hors
budget, biggest expenses, recurring bills paid, and the trend vs the previous
month. Language-agnostic (pure numbers/labels) — the prose is rendered later
from this snapshot. Reuses the expense-amount cast convention of
``budget.aggregations`` / ``interactions.aggregations``.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.db.models import Sum
from django.db.models.functions import Coalesce

from interactions.queries import expenses

from ..aggregations import _state, _str, _zero
from ..models import Budget

TOP_EXPENSES_LIMIT = 5


def _tz(household) -> ZoneInfo:
    try:
        return ZoneInfo(getattr(household, "timezone", "") or "UTC")
    except Exception:  # pragma: no cover - defensive
        return ZoneInfo("UTC")


def month_bounds(household, month: str) -> tuple[datetime, datetime]:
    """Return (start, end_exclusive) aware datetimes for a ``YYYY-MM`` month."""
    year, mon = (int(p) for p in month.split("-"))
    tz = _tz(household)
    start = datetime(year, mon, 1, tzinfo=tz)
    end = datetime(year + 1, 1, 1, tzinfo=tz) if mon == 12 else datetime(year, mon + 1, 1, tzinfo=tz)
    return start, end


def previous_month(month: str) -> str:
    year, mon = (int(p) for p in month.split("-"))
    if mon == 1:
        return f"{year - 1:04d}-12"
    return f"{year:04d}-{mon - 1:02d}"


def _expense_qs(household_id, start, end):
    return expenses(household_id=household_id).filter(
        occurred_at__gte=start, occurred_at__lt=end
    )


def _total(qs) -> Decimal:
    return qs.aggregate(t=Coalesce(Sum("amount"), _zero()))["t"] or _zero()


def compute_month_stats(household, month: str) -> dict[str, Any]:
    """Return the immutable numeric snapshot for ``household`` over ``month``.

    Shape (all amounts are ``str(Decimal)``)::

        {
          "month": "2026-06",
          "total_spent": "1240.50",
          "prev_month": "2026-05", "prev_total": "1090.00",
          "trend_delta": "150.50", "trend_pct": 13.8,
          "budgets": [{name, amount, spent, ratio, state}, ...],
          "unbudgeted": "300.00",
          "top_expenses": [{"subject": "...", "amount": "..."}, ...],
          "recurring": {"count": 3, "total": "95.00"},
          "global": {name, amount, spent, ratio, state} | null,
          "expense_count": 24
        }
    """
    start, end = month_bounds(household, month)
    qs = _expense_qs(household.id, start, end)

    spent_rows = qs.values("budget_id").annotate(total=Coalesce(Sum("amount"), _zero()))
    spent_map = {r["budget_id"]: r["total"] or _zero() for r in spent_rows}
    total_spent = sum(spent_map.values(), _zero())
    unbudgeted = spent_map.get(None, _zero())

    budgets = list(Budget.objects.filter(household_id=household.id))
    global_budget = next((b for b in budgets if b.is_global), None)

    def _row(b: Budget, spent: Decimal) -> dict[str, Any]:
        ratio, state = _state(spent, b.monthly_amount)
        return {
            "name": b.name,
            "amount": _str(b.monthly_amount),
            "spent": _str(spent),
            "ratio": round(ratio, 4),
            "state": state,
        }

    budget_rows = [_row(b, spent_map.get(b.id, _zero())) for b in budgets if not b.is_global]
    global_row = _row(global_budget, total_spent) if global_budget else None

    # Exclude amount-less expenses: on Postgres a NULL sorts NULLS FIRST under
    # DESC and would otherwise steal the "biggest expense" slot with a 0 amount.
    top = [
        {"subject": i.subject, "amount": _str(i.amount or _zero())}
        for i in qs.filter(amount__isnull=False).order_by("-amount")[:TOP_EXPENSES_LIMIT]
    ]

    recurring_qs = qs.filter(kind="recurring")
    recurring = {"count": recurring_qs.count(), "total": _str(_total(recurring_qs))}

    prev = previous_month(month)
    prev_start, prev_end = month_bounds(household, prev)
    prev_total = _total(_expense_qs(household.id, prev_start, prev_end))

    delta = total_spent - prev_total
    trend_pct = round(float(delta / prev_total) * 100, 1) if prev_total > 0 else None

    return {
        "month": month,
        "total_spent": _str(total_spent),
        "prev_month": prev,
        "prev_total": _str(prev_total),
        "trend_delta": _str(delta),
        "trend_pct": trend_pct,
        "budgets": budget_rows,
        "unbudgeted": _str(unbudgeted),
        "top_expenses": top,
        "recurring": recurring,
        "global": global_row,
        "expense_count": qs.count(),
    }
