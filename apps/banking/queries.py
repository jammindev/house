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


def allocated_expr():
    """Sum of the expenses this line has been split into.

    There is no ``Allocation`` table: a line split 80/40 carries two
    ``Interaction(type='expense')``. Summing them **is** reading how much of the
    line has been accounted for.
    """
    return Coalesce(
        Sum("interactions__amount", filter=Q(interactions__type="expense")),
        ZERO,
    )


def with_allocation(qs: QuerySet) -> QuerySet:
    """Annotate ``allocated`` and ``outflow_value`` on a transaction queryset.

    One definition for two readers that must never disagree: the Contrôle tab
    counts the écarts, the journal badges each line. Two copies of the same
    ``Sum`` would eventually differ by a filter, and the user would be told a line
    is fine in one screen and orphaned in the other.

    ``outflow_value``, not ``outflow``: the latter is already a property on the
    model, and an annotation cannot be assigned onto a property with no setter.
    """
    return qs.annotate(allocated=allocated_expr(), outflow_value=outflow_expr())


#: Nothing to allocate — a receipt, an internal movement, a cash counterpart.
#: Not a state of progress: an empty string renders no badge at all.
NOT_ALLOCATABLE = ""
#: Money out that nobody has said anything about.
UNALLOCATED = "unallocated"
#: Part of the line is accounted for, the rest is not.
PARTIAL = "partial"
#: Fully accounted for.
ALLOCATED = "allocated"
#: Outside the account's conformity window — House cannot require anything here,
#: so the line is *not* reported as untreated. Distinguishing this from
#: ``unallocated`` is the same rule as ``coverage.window_status``: a blank counter
#: means either "nothing to report" or "nothing evaluable", never both.
OUT_OF_SCOPE = "out_of_scope"


def allocation_state(txn, *, allocated: Decimal, window) -> str:
    """How far ``txn`` has been accounted for, from the reader's point of view.

    Mirrors the two detectors ``transaction_unallocated`` and
    ``transaction_partially_allocated`` exactly, window included — with one
    deliberate difference: a **fully** allocated line reads « ventilée » even
    outside the window. Being done is a fact; being required is a scope.
    """
    if txn.amount >= 0 or txn.is_internal or txn.transfer_counterpart_id:
        return NOT_ALLOCATABLE

    outflow = -txn.amount
    if allocated >= outflow:
        return ALLOCATED
    if window is None or not window.contains(txn.booked_on):
        return OUT_OF_SCOPE
    return PARTIAL if allocated > 0 else UNALLOCATED


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
