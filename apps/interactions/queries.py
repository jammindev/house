"""Shared query helpers for expense interactions — single point of truth.

Since the "expense columns" refactor, the money fields (``amount``, ``kind``,
``supplier``) live in real columns on ``Interaction`` instead of being cast out
of ``metadata`` JSON on every read. This module is the ONE place that knows how
to select expenses, so every consumer (project cost, budget overview, monthly
report, expense summary, agent aggregation) filters and sums them the same way.

Before this module the ``Cast(KeyTextTransform("amount", "metadata"), Decimal)``
pattern was duplicated across four aggregation modules
(cf. docs/fiches/CARTOGRAPHIE_DEPENSES.md, dette ①).
"""
from __future__ import annotations

from decimal import Decimal

from django.db.models import DecimalField, QuerySet, Sum, Value
from django.db.models.functions import Coalesce

from .models import Interaction

# Money field spec shared by every expense aggregation.
AMOUNT_FIELD = DecimalField(max_digits=14, decimal_places=2)
ZERO = Value(Decimal("0.00"), output_field=AMOUNT_FIELD)


def expenses(*, household_id=None, base: QuerySet | None = None) -> QuerySet:
    """Base queryset of expense interactions.

    Pass ``household_id`` to scope to a household, or ``base`` to start from an
    existing queryset (e.g. an ``OuterRef`` subquery in a project cost rollup).
    No amount cast anymore — ``amount`` is a real Decimal column.
    """
    qs = base if base is not None else Interaction.objects.all()
    qs = qs.filter(type="expense")
    if household_id is not None:
        qs = qs.filter(household_id=household_id)
    return qs


def sum_amount(qs: QuerySet) -> Decimal:
    """SUM of the ``amount`` column over ``qs``, coalesced to 0.00."""
    return qs.aggregate(total=Coalesce(Sum("amount"), ZERO))["total"] or Decimal("0.00")
