"""Banking's own compliance detectors — the first five entries of the catalogue.

Each one answers a question the household would otherwise have to ask itself, and
would therefore never ask:

- money left the account and nobody said what for (``transaction_unallocated``);
- money left and only part of it was accounted for (``transaction_partial``);
- an expense was typed in that the bank never saw (``expense_unreconciled``);
- an account whose starting point is unknown (``account_no_opening_balance``);
- an account whose statements do not chain (``account_chain_broken``).

Every detector that reasons about "money we should know about" is scoped by
``banking.coverage``: outside the conformity window an écart is not an écart, it
is history or it is tomorrow. That scoping is what makes zero reachable.

Registered from ``banking.apps.BankingConfig.ready()``.
"""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Case, DecimalField, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce

from .balances import check_balance_chain
from .compliance import (
    BLOCKER,
    ERROR,
    WARNING,
    DetectorSpec,
    Finding,
    apply_window,
    fingerprint_of,
    get_detector,
    register,
)
from .coverage import accounts_with_window, household_covered_period
from .models import BankAccount, BankTransaction

AMOUNT_FIELD = DecimalField(max_digits=14, decimal_places=2)
ZERO = Value(Decimal("0.00"), output_field=AMOUNT_FIELD)

#: Kind keys — imported by tests and by the services layer, never retyped.
TRANSACTION_UNALLOCATED = "transaction_unallocated"
TRANSACTION_PARTIAL = "transaction_partially_allocated"
EXPENSE_UNRECONCILED = "expense_unreconciled"
ACCOUNT_NO_OPENING_BALANCE = "account_no_opening_balance"
ACCOUNT_CHAIN_BROKEN = "account_chain_broken"


# --- Shared base: spendable outflows inside their account's window -----------


def _allocatable_outflows(household):
    """Outgoing operations the household is expected to account for.

    Excluded, and each for its own reason:

    - inflows: a receipt is not spending (its own detector lands in lot 5);
    - internal movements and their counterparts: the money is counted once, later,
      when the cash they fed is actually spent — allocating them would double it,
      which is the same rule ``validators.assert_allocation_fits`` enforces;
    - anything outside its account's conformity window.

    Matches nothing when no account has a window at all: nothing can be asserted,
    and the prerequisite detector is the one doing the talking. That case is an
    impossible ``Q``, not ``.none()`` — an ``EmptyQuerySet`` carries no annotations,
    so callers filtering on ``allocated`` would hit a ``FieldError`` instead of
    getting zero rows.
    """
    pairs = accounts_with_window(household)

    scope = Q(pk__in=[])
    for account, window in pairs:
        scope |= Q(account=account, booked_on__gte=window.start, booked_on__lte=window.end)

    return (
        BankTransaction.objects.filter(household=household)
        .filter(scope)
        .filter(amount__lt=0, is_internal=False, transfer_counterpart__isnull=True)
        .annotate(
            allocated=Coalesce(
                Sum(
                    "interactions__amount",
                    filter=Q(interactions__type="expense"),
                ),
                ZERO,
            ),
            # NOT ``outflow``: that name is already a property on the model, and
            # an annotation cannot be assigned onto a property without a setter.
            outflow_value=Case(
                When(amount__lt=0, then=-1 * F("amount")),
                default=ZERO,
                output_field=AMOUNT_FIELD,
            ),
        )
        .select_related("account")
    )


def _unallocated_qs(household):
    return _allocatable_outflows(household).filter(allocated__lte=Decimal("0.00"))


def _partial_qs(household):
    return _allocatable_outflows(household).filter(
        allocated__gt=Decimal("0.00"), allocated__lt=F("outflow_value")
    )


def _transaction_finding(kind: str, txn, *, remaining: Decimal) -> Finding:
    return Finding(
        kind=kind,
        object_id=str(txn.pk),
        label=f"{txn.booked_on.isoformat()} · {txn.label_raw[:80]}",
        # The remaining amount is what founds the écart: allocate part of it and
        # the arbitration that covered the whole must be reconsidered.
        fingerprint=fingerprint_of(kind, remaining),
        detail={
            "account": str(txn.account_id),
            "account_name": txn.account.name,
            "booked_on": txn.booked_on.isoformat(),
            "label": txn.label_raw,
            "outflow": str(txn.outflow),
            "allocated": str(txn.allocated),
            "remaining": str(remaining),
        },
    )


def _count_unallocated(household) -> int:
    return _unallocated_qs(household).count()


def _find_unallocated(household, **window) -> list[Finding]:
    return [
        _transaction_finding(TRANSACTION_UNALLOCATED, txn, remaining=txn.outflow)
        for txn in apply_window(_unallocated_qs(household), **window)
    ]


def _count_partial(household) -> int:
    return _partial_qs(household).count()


def _find_partial(household, **window) -> list[Finding]:
    return [
        _transaction_finding(
            TRANSACTION_PARTIAL, txn, remaining=txn.outflow - txn.allocated
        )
        for txn in apply_window(_partial_qs(household), **window)
    ]


# --- Expenses the bank never saw ---------------------------------------------


def _unreconciled_qs(household):
    """Expenses with no bank line, inside the household's conformity horizon.

    The partial index ``idx_int_unreconciled_amount`` (posed in parcours 25 for
    the matcher) serves exactly this filter.

    The date bounds are the whole point: an expense from before any account was
    tracked has no line to be attached to and never will, and one from after the
    last statement is simply waiting for the next import. Neither is an orphan.
    """
    from interactions.queries import expenses

    window = household_covered_period(household)
    if window is None:
        from interactions.models import Interaction

        return Interaction.objects.none()

    return expenses(household_id=household.id).filter(
        bank_transaction__isnull=True,
        occurred_at__date__gte=window.start,
        occurred_at__date__lte=window.end,
    )


def _count_unreconciled(household) -> int:
    return _unreconciled_qs(household).count()


def _find_unreconciled(household, **window) -> list[Finding]:
    return [
        Finding(
            kind=EXPENSE_UNRECONCILED,
            object_id=str(expense.pk),
            label=f"{expense.occurred_at.date().isoformat()} · {expense.subject[:80]}",
            fingerprint=fingerprint_of(EXPENSE_UNRECONCILED, expense.amount),
            detail={
                "subject": expense.subject,
                "amount": str(expense.amount or Decimal("0.00")),
                "occurred_at": expense.occurred_at.isoformat(),
                "kind": expense.kind,
                "supplier": expense.supplier,
            },
        )
        for expense in apply_window(_unreconciled_qs(household), **window)
    ]


# --- Accounts ----------------------------------------------------------------


def _no_opening_balance_qs(household):
    return BankAccount.objects.filter(
        household=household, archived=False, opening_balance_date__isnull=True
    )


def _count_no_opening_balance(household) -> int:
    return _no_opening_balance_qs(household).count()


def _find_no_opening_balance(household, **window) -> list[Finding]:
    return [
        Finding(
            kind=ACCOUNT_NO_OPENING_BALANCE,
            object_id=str(account.pk),
            label=account.name,
            # Constant: there is nothing to re-arbitrate here, the field is either
            # filled or it is not. (And the écart is not waivable anyway.)
            fingerprint=fingerprint_of(ACCOUNT_NO_OPENING_BALANCE),
            detail={"name": account.name, "kind": account.kind},
        )
        for account in apply_window(_no_opening_balance_qs(household), **window)
    ]


def _chain_broken_pairs(household) -> list[tuple[BankAccount, list]]:
    """Accounts whose statement chain does not close, with their gaps.

    Python rather than SQL: the check is an arithmetic walk over consecutive
    balances (``previous.balance_after + amount == balance_after``), which no
    ``COUNT(*)`` can express. Acceptable because a household has a handful of
    accounts, not thousands — the cost is bounded by accounts, not by lines.
    """
    pairs = []
    for account in BankAccount.objects.filter(household=household, archived=False):
        gaps = check_balance_chain(account=account)
        if gaps:
            pairs.append((account, gaps))
    return pairs


def _count_chain_broken(household) -> int:
    return len(_chain_broken_pairs(household))


def _find_chain_broken(household, *, pks=None, exclude_pks=None, limit=None, offset=None):
    pairs = _chain_broken_pairs(household)
    if pks is not None:
        wanted = {str(p) for p in pks}
        pairs = [p for p in pairs if str(p[0].pk) in wanted]
    if exclude_pks:
        unwanted = {str(p) for p in exclude_pks}
        pairs = [p for p in pairs if str(p[0].pk) not in unwanted]
    if offset or limit:
        start = offset or 0
        pairs = pairs[start : start + limit] if limit else pairs[start:]

    return [
        Finding(
            kind=ACCOUNT_CHAIN_BROKEN,
            object_id=str(account.pk),
            label=account.name,
            # The total missing amount founds the écart: importing the statement
            # that closes part of the hole must invalidate an arbitration that
            # accepted the whole of it.
            fingerprint=fingerprint_of(
                ACCOUNT_CHAIN_BROKEN,
                len(gaps),
                sum((g.missing_amount for g in gaps), Decimal("0.00")),
            ),
            detail={
                "name": account.name,
                "gap_count": len(gaps),
                "missing_amount": str(sum((g.missing_amount for g in gaps), Decimal("0.00"))),
                "gaps": [
                    {
                        "gap_start": g.gap_start.isoformat(),
                        "gap_end": g.gap_end.isoformat(),
                        "missing_amount": str(g.missing_amount),
                    }
                    for g in gaps
                ],
            },
        )
        for account, gaps in pairs
    ]


def register_detectors() -> None:
    """Called from ``BankingConfig.ready()``.

    Idempotent: ``register`` rejects a duplicate kind (which is what catches a real
    copy-paste mistake), so re-entering ``ready()`` — as a test that reloads apps
    does — must not blow up.
    """
    for spec in _specs():
        if get_detector(spec.kind) is None:
            register(spec)


def _specs() -> list[DetectorSpec]:
    """Declared in the order the control panel should read them: the blocking
    prerequisite first, because it is what makes the others meaningful."""
    from interactions.models import Interaction

    return [
        DetectorSpec(
            kind=ACCOUNT_NO_OPENING_BALANCE,
            severity=BLOCKER,
            label="Account without an opening balance date",
            target="account",
            model=BankAccount,
            count=_count_no_opening_balance,
            findings=_find_no_opening_balance,
            # A prerequisite, not an arbitration: without it the account has no
            # conformity window, so no other control can say anything about it.
            waivable=False,
        ),
        DetectorSpec(
            kind=TRANSACTION_UNALLOCATED,
            severity=ERROR,
            label="Outgoing operation nobody accounted for",
            target="transaction",
            model=BankTransaction,
            count=_count_unallocated,
            findings=_find_unallocated,
            blocked_by=ACCOUNT_NO_OPENING_BALANCE,
        ),
        DetectorSpec(
            kind=TRANSACTION_PARTIAL,
            severity=ERROR,
            label="Outgoing operation only partly accounted for",
            target="transaction",
            model=BankTransaction,
            count=_count_partial,
            findings=_find_partial,
            blocked_by=ACCOUNT_NO_OPENING_BALANCE,
        ),
        DetectorSpec(
            kind=EXPENSE_UNRECONCILED,
            severity=WARNING,
            label="Expense the bank statements never confirmed",
            target="expense",
            model=Interaction,
            count=_count_unreconciled,
            findings=_find_unreconciled,
            blocked_by=ACCOUNT_NO_OPENING_BALANCE,
        ),
        DetectorSpec(
            kind=ACCOUNT_CHAIN_BROKEN,
            severity=ERROR,
            label="Statement balances do not chain — operations are missing",
            target="account",
            model=BankAccount,
            count=_count_chain_broken,
            findings=_find_chain_broken,
        ),
    ]
