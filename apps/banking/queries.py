"""Shared query helpers for bank transactions — single point of truth.

Mirror of ``interactions.queries``, and for the same reason: the moment two
modules write their own transaction filter, they drift. Everything that reads
transactions (the journal, the flow aggregates, the lot 4 balances, the lot 6
matcher) goes through here.

**The sign convention lives here and nowhere else.** ``BankTransaction.amount``
is signed while ``Interaction.amount`` is always positive; every bridge between
the two worlds uses ``outflow_expr()`` rather than writing ``abs()`` inline.
"""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Case, DecimalField, F, Q, QuerySet, Sum, Value, When
from django.db.models.functions import Coalesce

from .models import BankTransaction

#: Money field spec shared by every banking aggregation.
AMOUNT_FIELD = DecimalField(max_digits=14, decimal_places=2)
ZERO = Value(Decimal("0.00"), output_field=AMOUNT_FIELD)


def transactions(*, household_id=None, base: QuerySet | None = None) -> QuerySet:
    """Base queryset of bank transactions, scoped to a household."""
    qs = base if base is not None else BankTransaction.objects.all()
    if household_id is not None:
        qs = qs.filter(household_id=household_id)
    return qs


def spendable(qs: QuerySet) -> QuerySet:
    """Transactions that represent real money movement for the household.

    Internal movements (ATM withdrawals, transfers between the household's own
    accounts) are excluded: counting them would double the money, since the cash
    they feed is spent again on the other side.
    """
    return qs.filter(is_internal=False)


def outflow_expr():
    """Positive magnitude of money leaving, zero otherwise.

    The single place the signed/unsigned bridge is expressed in SQL. Aggregating
    ``Sum("amount")`` over a mixed queryset would net inflows against outflows
    and silently understate spending.
    """
    return Case(
        When(amount__lt=0, then=-1 * F("amount")),
        default=ZERO,
        output_field=AMOUNT_FIELD,
    )


def inflow_expr():
    """Positive magnitude of money arriving, zero otherwise."""
    return Case(
        When(amount__gt=0, then=F("amount")),
        default=ZERO,
        output_field=AMOUNT_FIELD,
    )


def sum_outflow(qs: QuerySet) -> Decimal:
    """Total money out over ``qs``, as a positive number."""
    return qs.aggregate(total=Coalesce(Sum(outflow_expr()), ZERO))["total"] or Decimal("0.00")


def sum_inflow(qs: QuerySet) -> Decimal:
    """Total money in over ``qs``, as a positive number."""
    return qs.aggregate(total=Coalesce(Sum(inflow_expr()), ZERO))["total"] or Decimal("0.00")


def search(qs: QuerySet, term: str) -> QuerySet:
    """Filter on the label.

    Searches ``label_norm`` — already upper-cased and stripped of diacritics by
    the importer — after normalizing the term the same way. That makes the search
    accent- and case-insensitive without an ``unaccent`` extension call per row,
    which is the whole reason the normalized column exists.
    """
    from .importers.parsing import normalize_label

    normalized = normalize_label(term)
    if not normalized:
        return qs
    return qs.filter(Q(label_norm__contains=normalized) | Q(notes__icontains=term))
