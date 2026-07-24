"""
Expense summary aggregations.

Builds totals + breakdowns over `Interaction(type='expense')` for a given
period. Reads the ``amount`` / ``kind`` / ``supplier`` columns directly via the
shared ``interactions.queries`` helpers — no more JSON cast.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce, TruncMonth

from .queries import expenses


def _expense_qs(household_id, from_dt: datetime | None, to_dt: datetime | None,
                supplier: str | None = None, kind: str | None = None):
    qs = expenses(household_id=household_id)
    if from_dt is not None:
        qs = qs.filter(occurred_at__gte=from_dt)
    if to_dt is not None:
        qs = qs.filter(occurred_at__lte=to_dt)
    if supplier is not None:
        qs = qs.filter(supplier=supplier)
    if kind is not None:
        qs = qs.filter(kind=kind)
    return qs


def _zero() -> Decimal:
    return Decimal('0.00')


def _str(amount: Decimal | None) -> str:
    return str(amount if amount is not None else _zero())


def compute_expense_summary(
    *,
    household_id,
    from_dt: datetime | None,
    to_dt: datetime | None,
    supplier: str | None = None,
    kind: str | None = None,
) -> dict[str, Any]:
    """Return totals + breakdowns for expense interactions in the period.

    Shape:
        {
          "period": {"from": ISO|null, "to": ISO|null},
          "total": "1247.83",
          "count": 18,
          "by_kind": [{"kind": "stock_purchase", "total": "342.00", "count": 5}, ...],
          "by_supplier": [{"supplier": "Engie", "total": "142.67", "count": 1}, ...],
          "by_month": [{"month": "2026-05", "total": "1247.83", "count": 18}, ...],
        }
    """
    qs = _expense_qs(household_id, from_dt, to_dt, supplier=supplier, kind=kind)

    overall = qs.aggregate(
        total=Coalesce(Sum('amount'), _zero()),
        count=Count('id'),
    )

    by_kind_rows = (
        qs.values('kind')
        .annotate(total=Coalesce(Sum('amount'), _zero()), count=Count('id'))
        .order_by('-total')
    )
    by_kind = [
        {
            'kind': row['kind'] or '',
            'total': _str(row['total']),
            'count': row['count'],
        }
        for row in by_kind_rows
    ]

    by_supplier_rows = (
        qs.values('supplier')
        .annotate(total=Coalesce(Sum('amount'), _zero()), count=Count('id'))
        .order_by('-total')
    )
    by_supplier = [
        {
            'supplier': row['supplier'] or '',
            'total': _str(row['total']),
            'count': row['count'],
        }
        for row in by_supplier_rows
    ]

    by_month_rows = (
        qs.annotate(month_start=TruncMonth('occurred_at'))
        .values('month_start')
        .annotate(total=Coalesce(Sum('amount'), _zero()), count=Count('id'))
        .order_by('month_start')
    )
    by_month = [
        {
            'month': row['month_start'].strftime('%Y-%m') if row['month_start'] else '',
            'total': _str(row['total']),
            'count': row['count'],
        }
        for row in by_month_rows
    ]

    return {
        'period': {
            'from': from_dt.isoformat() if from_dt else None,
            'to': to_dt.isoformat() if to_dt else None,
        },
        'total': _str(overall['total']),
        'count': overall['count'],
        'by_kind': by_kind,
        'by_supplier': by_supplier,
        'by_month': by_month,
    }
