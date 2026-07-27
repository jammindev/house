"""Finding the opening balance when the bank never told you what it was.

The derived balance needs a starting point: a balance at a **past** date. But a
bank app only ever shows you *today's* balance, and a good half of French
exports — Crédit Agricole's among them — carry no balance column at all. So the
one figure the user can obtain is the one the model does not ask for, and the
figure the model asks for is the one nobody can look up.

That mismatch is what left real accounts with an opening date set to *today*,
which puts the conformity window after all the data and silences every control
(see ``coverage.OPENING_DATE_AFTER_DATA``).

The way out is arithmetic, not a guess. Two paths, and House picks the surest
one available rather than asking the user first:

**1. The statement knows.** If any line carries the bank's own running balance,
the opening balance is a subtraction over lines we hold — no user input, no
attestation, nothing to be wrong about.

**2. Nobody knows but the user.** With no balance column anywhere, the user
reads today's balance and House subtracts the movements back to the start.
Exact *if* every operation of the interval is imported — which is precisely the
part we must not take on faith. Hence:

- what House **can** verify, it verifies and refuses on: a balance read before
  the lines we already hold, a period nobody imported inside the interval;
- what only the user **can attest** — "nothing happened since that my statement
  does not show" — is asked explicitly, next to the last operation House knows;
- and the attestation is **kept** (``attested_balance`` / ``attested_on``), so
  the subtraction is re-checked at every recompute. Import a forgotten week
  inside the interval and the arithmetic stops closing: the
  ``account_anchor_stale`` detector says so instead of leaving every balance on
  the account quietly wrong by the amount of that week.

That last point is the whole reason this is a stored anchor and not a one-shot
wizard. A reconstruction that cannot be re-verified is exactly the silent
orphan parcours 26 exists to remove.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from django.db.models import Sum

from .coverage import Window, period_gaps
from .models import BankTransaction

ZERO = Decimal("0.00")

#: The opening balance was read off the bank's own running balance.
FROM_STATEMENT = "statement"
#: The opening balance was reconstructed from a balance the user attested.
FROM_ATTESTATION = "attestation"
#: Nothing to reconstruct from — the account holds no line.
NO_SOURCE = "none"


class AnchorError(ValueError):
    """A reconstruction we refuse to perform, with a reason the user can act on."""

    def __init__(self, code: str, message: str, detail: dict | None = None):
        super().__init__(message)
        self.code = code
        self.detail = detail or {}


@dataclass(frozen=True)
class Operation:
    """One line, as shown to the user to confirm House holds everything."""

    booked_on: date
    label: str
    amount: Decimal


@dataclass(frozen=True)
class AnchorContext:
    """What House knows before asking the user anything.

    The dialog is built entirely from this: which of the two paths applies, what
    the last operation is (so the user can compare it with their bank), and what
    would block the reconstruction.
    """

    source: str
    transaction_count: int
    earliest_line: date | None
    latest_line: date | None
    last_operation: Operation | None
    #: Net of everything held, so the UI can show the subtraction *before* the
    #: user commits to it. A figure they cannot re-derive is one they cannot check.
    movements: Decimal
    #: Set only when ``source == FROM_STATEMENT``: the value House would apply.
    proposed_opening_balance: Decimal | None
    proposed_opening_date: date | None
    #: Holes in the imported periods over the reconstructible interval.
    gaps: list[dict] = field(default_factory=list)


def _ordered(account):
    """Oldest first, in the statement's own order — same key as ``balances``."""
    return BankTransaction.objects.filter(account=account).order_by(
        "booked_on", "line_no", "created_at"
    )


def anchor_context(account) -> AnchorContext:
    """Everything the reconstruction UI needs, and nothing it should invent."""
    transactions = list(_ordered(account))
    if not transactions:
        return AnchorContext(
            source=NO_SOURCE,
            transaction_count=0,
            earliest_line=None,
            latest_line=None,
            last_operation=None,
            movements=ZERO,
            proposed_opening_balance=None,
            proposed_opening_date=None,
        )

    earliest = transactions[0].booked_on
    latest = max(t.booked_on for t in transactions)
    last = transactions[-1]
    statement = opening_from_statement(transactions)

    return AnchorContext(
        source=FROM_STATEMENT if statement is not None else FROM_ATTESTATION,
        transaction_count=len(transactions),
        earliest_line=earliest,
        latest_line=latest,
        last_operation=Operation(
            booked_on=last.booked_on, label=last.label_raw, amount=last.amount
        ),
        movements=sum((t.amount for t in transactions), ZERO),
        proposed_opening_balance=statement,
        proposed_opening_date=earliest if statement is not None else None,
        gaps=period_gaps(account, between=Window(start=earliest, end=latest)),
    )


def opening_from_statement(transactions: list[BankTransaction]) -> Decimal | None:
    """Opening balance at the first line's date, read off the bank's own figures.

    Walk to the earliest line carrying a running balance and undo it: the balance
    printed after that line, minus every amount up to and including it, is what
    the account held before the first line. Nothing here is attested — the bank
    said it.

    Returns ``None`` when no line carries a balance, which is the common case for
    a Crédit Agricole export and the reason path 2 exists.
    """
    for index, transaction in enumerate(transactions):
        if transaction.balance_after is None:
            continue
        moved = sum((t.amount for t in transactions[: index + 1]), ZERO)
        return transaction.balance_after - moved
    return None


def movements_between(account, *, start: date, end: date) -> Decimal:
    """Net of every line booked in ``[start, end]``, signed as the bank signs it."""
    total = BankTransaction.objects.filter(
        account=account, booked_on__gte=start, booked_on__lte=end
    ).aggregate(total=Sum("amount"))["total"]
    return total if total is not None else ZERO


def opening_from_attestation(
    account, *, balance: Decimal, as_of: date, from_date: date, today: date
) -> tuple[Decimal, Decimal]:
    """Reconstruct the opening balance from a balance the user read.

    Returns ``(opening_balance, movements)`` so the caller can show the whole
    subtraction rather than a number out of nowhere — a figure the user cannot
    re-derive is a figure they cannot check.

    Raises :class:`AnchorError` on everything House is able to disprove. The list
    is deliberately short: each refusal must correspond to a real way of getting
    the balance wrong, otherwise it is just a form fighting its user.
    """
    if as_of > today:
        raise AnchorError(
            "as_of_in_future",
            "A balance cannot be read on a date that has not happened yet.",
        )
    if from_date > as_of:
        raise AnchorError(
            "from_after_as_of",
            "The starting date must come before the balance you read.",
        )

    context = anchor_context(account)
    if context.transaction_count == 0:
        raise AnchorError(
            "no_transactions",
            "Nothing to subtract: import this account's statement first, or type "
            "the opening balance directly.",
        )

    # A balance read *before* lines we already hold cannot be walked back: the
    # operations after it are in the file but not in the figure, so the
    # subtraction would silently count them twice.
    if context.latest_line is not None and as_of < context.latest_line:
        raise AnchorError(
            "as_of_before_last_line",
            "You hold operations more recent than that balance — read the balance "
            "again, after them.",
            {"latest_line": context.latest_line.isoformat()},
        )

    # A period nobody imported inside the interval means the subtraction is short
    # by an unknown amount. Reconstructing anyway would bake that hole into the
    # opening balance, where nothing would ever find it again.
    gaps = period_gaps(account, between=Window(start=from_date, end=as_of))
    if gaps:
        raise AnchorError(
            "period_gap",
            "A period of this interval was never imported: the movements to "
            "subtract are incomplete.",
            {"gaps": gaps},
        )

    movements = movements_between(account, start=from_date, end=as_of)
    return (balance - movements, movements)


def serialize_anchor_context(context: AnchorContext) -> dict:
    """API shape. Decimals become strings, as everywhere else in the project."""
    return {
        "source": context.source,
        "transaction_count": context.transaction_count,
        "earliest_line": context.earliest_line.isoformat() if context.earliest_line else None,
        "latest_line": context.latest_line.isoformat() if context.latest_line else None,
        "movements": str(context.movements),
        "last_operation": (
            {
                "booked_on": context.last_operation.booked_on.isoformat(),
                "label": context.last_operation.label,
                "amount": str(context.last_operation.amount),
            }
            if context.last_operation
            else None
        ),
        "proposed_opening_balance": (
            str(context.proposed_opening_balance)
            if context.proposed_opening_balance is not None
            else None
        ),
        "proposed_opening_date": (
            context.proposed_opening_date.isoformat()
            if context.proposed_opening_date
            else None
        ),
        "gaps": context.gaps,
    }


def attestation_drift(account) -> Decimal | None:
    """How far the computed balance has drifted from what the user attested.

    Zero by construction the moment the attestation is recorded. It stops being
    zero when the lines underneath move — a forgotten week imported afterwards,
    a transaction deleted — which is exactly when the opening balance computed
    from it stopped being right.

    ``None`` when there is no attestation to check, or no opening date to compute
    from (that account has a louder problem already).
    """
    if account.attested_on is None or account.attested_balance is None:
        return None
    if account.opening_balance_date is None:
        return None

    computed = (account.opening_balance or ZERO) + movements_between(
        account, start=account.opening_balance_date, end=account.attested_on
    )
    return computed - account.attested_balance
