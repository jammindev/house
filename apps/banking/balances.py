"""Account balances — computed at read time, never stored.

The balance is not a feature so much as **the test of the import**. If the
figure House computes matches the one printed on the paper statement, the import
is right; if it drifts, something is missing and the user needs to know *before*
they allocate six months of spending onto wrong data.

Hence the two rules of this module:

1. **Never denormalize.** No ``current_balance`` column updated on write — it
   would be a second source of truth that drifts on the first partial import.
   Same rule as the budget "spent" of parcours 21.
2. **Never show a wrong balance with confidence.** When the statement chain has a
   hole, we say so (``is_reliable=False`` + the gap interval) instead of printing
   a plausible-looking number.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from django.db.models import Sum

from .models import BankTransaction


@dataclass(frozen=True)
class ChainGap:
    """A break in the running-balance chain: operations are missing.

    ``expected`` is what the previous line's balance plus this line's amount
    should have produced; ``actual`` is what the bank actually printed. The
    difference is the money we have no line for.
    """

    after_transaction_id: str
    gap_start: date
    gap_end: date
    expected: Decimal
    actual: Decimal

    @property
    def missing_amount(self) -> Decimal:
        return self.actual - self.expected


@dataclass(frozen=True)
class BalanceResult:
    """A balance, with an honest account of how much it can be trusted."""

    amount: Decimal
    #: ``anchored`` = read off the bank's own running balance (no assumption of
    #: continuity). ``derived`` = opening balance + sum of movements, which is
    #: only exact if no statement is missing.
    source: str
    as_of: date | None
    is_reliable: bool
    gaps: list[ChainGap] = field(default_factory=list)


ANCHORED = "anchored"
DERIVED = "derived"


def _ordered(account, *, as_of: date | None = None):
    """Transactions oldest-first, in the statement's own order.

    ``line_no`` is what keeps two operations booked the same day in the order the
    bank printed them — without it the chain check compares balances that never
    followed each other.
    """
    qs = BankTransaction.objects.filter(account=account)
    if as_of is not None:
        qs = qs.filter(booked_on__lte=as_of)
    return qs.order_by("booked_on", "line_no", "created_at")


def compute_balance(*, account, as_of: date | None = None) -> BalanceResult:
    """Balance of ``account``, optionally as of a date.

    Anchored when the bank exports a running balance: we take the most recent
    line that carries one and add whatever came after it. That needs no
    continuity assumption at all — a missing January does not corrupt a March
    balance.

    Derived otherwise: ``opening_balance`` plus every movement since
    ``opening_balance_date``. Exact only if nothing is missing, which is why a
    derived balance without an opening date is reported as unreliable — summing
    from an assumed start is a guess, and saying so is cheaper than being wrong.
    """
    transactions = list(_ordered(account, as_of=as_of))
    gaps = _detect_gaps(transactions)

    anchor_index = _last_anchor_index(transactions)
    if anchor_index is not None:
        anchor = transactions[anchor_index]
        after = sum(
            (t.amount for t in transactions[anchor_index + 1 :]),
            Decimal("0.00"),
        )
        return BalanceResult(
            amount=anchor.balance_after + after,
            source=ANCHORED,
            as_of=as_of,
            is_reliable=not gaps,
            gaps=gaps,
        )

    opening = account.opening_balance or Decimal("0.00")
    qs = BankTransaction.objects.filter(account=account)
    if account.opening_balance_date is not None:
        qs = qs.filter(booked_on__gte=account.opening_balance_date)
    if as_of is not None:
        qs = qs.filter(booked_on__lte=as_of)
    movements = qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    return BalanceResult(
        amount=opening + movements,
        source=DERIVED,
        as_of=as_of,
        is_reliable=not gaps and account.opening_balance_date is not None,
        gaps=gaps,
    )


def _last_anchor_index(transactions: list[BankTransaction]) -> int | None:
    """Index of the most recent line carrying the bank's running balance."""
    for index in range(len(transactions) - 1, -1, -1):
        if transactions[index].balance_after is not None:
            return index
    return None


def _detect_gaps(transactions: list[BankTransaction]) -> list[ChainGap]:
    """Find breaks in the running-balance chain.

    Between two consecutive lines that both carry a balance, the arithmetic must
    close: ``previous.balance_after + current.amount == current.balance_after``.
    When it does not, operations are missing between the two — the bank's own
    figures are telling us so, for free.

    Lines without a balance are skipped rather than treated as a break: a file
    that carries no balance column simply cannot be checked this way, and
    inventing a gap would be worse than admitting we cannot verify.
    """
    anchored = [t for t in transactions if t.balance_after is not None]
    gaps: list[ChainGap] = []

    for previous, current in zip(anchored, anchored[1:]):
        expected = previous.balance_after + current.amount
        if expected != current.balance_after:
            gaps.append(
                ChainGap(
                    after_transaction_id=str(previous.id),
                    gap_start=previous.booked_on,
                    gap_end=current.booked_on,
                    expected=expected,
                    actual=current.balance_after,
                )
            )

    return gaps


def check_balance_chain(*, account) -> list[ChainGap]:
    """Public entry point for the chain check alone (no balance computation)."""
    return _detect_gaps(list(_ordered(account)))


def serialize_balance(result: BalanceResult) -> dict:
    """API shape. Decimals become strings, as everywhere else in the project."""
    return {
        "amount": str(result.amount),
        "source": result.source,
        "as_of": result.as_of.isoformat() if result.as_of else None,
        "is_reliable": result.is_reliable,
        "gaps": [
            {
                "after_transaction_id": gap.after_transaction_id,
                "gap_start": gap.gap_start.isoformat(),
                "gap_end": gap.gap_end.isoformat(),
                "expected": str(gap.expected),
                "actual": str(gap.actual),
                "missing_amount": str(gap.missing_amount),
            }
            for gap in result.gaps
        ],
    }
