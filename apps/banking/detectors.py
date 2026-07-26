"""Banking's own compliance detectors — most of the orphan catalogue.

Each one answers a question the household would otherwise have to ask itself, and
would therefore never ask:

- money left the account and nobody said what for (``transaction_unallocated``);
- money left and only part of it was accounted for (``transaction_partial``);
- an expense was typed in that the bank never saw (``expense_unreconciled``);
- an expense that counts against no envelope (``expense_without_budget``);
- an account whose starting point is unknown (``account_no_opening_balance``);
- an account whose statements do not chain (``account_chain_broken``);
- a cash account in the red, which is physically impossible (``account_cash_negative``);
- a receipt nobody classified (``inflow_unclassified``);
- an internal movement whose other leg is missing (``internal_without_counterpart``);
- a recurrence past due with nothing recorded (``recurring_overdue``);
- a recurrence confirmed twice for the same day (``recurring_double_confirmed``).

Every detector that reasons about "money we should know about" is scoped by
``banking.coverage``: outside the conformity window an écart is not an écart, it
is history or it is tomorrow. That scoping is what makes zero reachable.

Registered from ``banking.apps.BankingConfig.ready()``.
"""
from __future__ import annotations

from datetime import date
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
EXPENSE_WITHOUT_BUDGET = "expense_without_budget"
ACCOUNT_NO_OPENING_BALANCE = "account_no_opening_balance"
ACCOUNT_CHAIN_BROKEN = "account_chain_broken"
ACCOUNT_CASH_NEGATIVE = "account_cash_negative"
INFLOW_UNCLASSIFIED = "inflow_unclassified"
INTERNAL_WITHOUT_COUNTERPART = "internal_without_counterpart"
RECURRING_OVERDUE = "recurring_overdue"
RECURRING_DOUBLE_CONFIRMED = "recurring_double_confirmed"


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


def _without_budget_qs(household):
    """Expenses inside the horizon that count against no envelope.

    Scoped by the same window as the rest, for a reason of its own: a budget is
    **monthly**, so assigning one to a two-year-old expense changes no figure
    anybody looks at. Flagging it would be busywork, and busywork is what makes a
    control panel stop being read.
    """
    from interactions.models import Interaction
    from interactions.queries import expenses

    window = household_covered_period(household)
    if window is None:
        return Interaction.objects.none()

    return expenses(household_id=household.id).filter(
        budget__isnull=True,
        occurred_at__date__gte=window.start,
        occurred_at__date__lte=window.end,
    )


def _count_without_budget(household) -> int:
    return _without_budget_qs(household).count()


def _find_without_budget(household, **window) -> list[Finding]:
    return [
        Finding(
            kind=EXPENSE_WITHOUT_BUDGET,
            object_id=str(expense.pk),
            label=f"{expense.occurred_at.date().isoformat()} · {expense.subject[:80]}",
            fingerprint=fingerprint_of(EXPENSE_WITHOUT_BUDGET, expense.amount),
            detail={
                "subject": expense.subject,
                "amount": str(expense.amount or Decimal("0.00")),
                "occurred_at": expense.occurred_at.isoformat(),
                "kind": expense.kind,
            },
        )
        for expense in apply_window(_without_budget_qs(household), **window)
    ]


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


# --- Receipts and internal movements (lot 5) ---------------------------------


def _scoped_lines(household):
    """Every line inside its account's conformity window, unfiltered otherwise."""
    pairs = accounts_with_window(household)
    scope = Q(pk__in=[])
    for account, window in pairs:
        scope |= Q(account=account, booked_on__gte=window.start, booked_on__lte=window.end)
    return (
        BankTransaction.objects.filter(household=household).filter(scope).select_related("account")
    )


def _unclassified_inflow_qs(household):
    """Receipts nobody has said anything about.

    A 2 100 € credit can be a wage, a refund of money already counted as spending,
    or the household's own transfer coming back. The three mean completely
    different things about how much money there actually is, so leaving it blank is
    a real gap — not a cosmetic one.

    Internal movements are excluded: a transfer already *says* what it is, and its
    own detector checks it has a counterpart.
    """
    return _scoped_lines(household).filter(
        amount__gt=0, is_internal=False, inflow_nature=""
    )


def _count_unclassified_inflow(household) -> int:
    return _unclassified_inflow_qs(household).count()


def _find_unclassified_inflow(household, **window) -> list[Finding]:
    return [
        Finding(
            kind=INFLOW_UNCLASSIFIED,
            object_id=str(txn.pk),
            label=f"{txn.booked_on.isoformat()} · {txn.label_raw[:80]}",
            fingerprint=fingerprint_of(INFLOW_UNCLASSIFIED, txn.amount),
            detail={
                "account_name": txn.account.name,
                "booked_on": txn.booked_on.isoformat(),
                "label": txn.label_raw,
                "amount": str(txn.amount),
            },
        )
        for txn in apply_window(_unclassified_inflow_qs(household), **window)
    ]


def _internal_without_counterpart_qs(household):
    """Internal movements whose other leg was never recorded.

    An internal movement is excluded from spending on the promise that the money
    reappears somewhere — as cash in a pot, or as a credit on another account. When
    the counterpart is missing, that promise is broken: the money left the tracked
    world and nothing accounts for it. It is the quietest way to lose track of a
    few hundred euros, which is why it earns a detector rather than a note.
    """
    return _scoped_lines(household).filter(
        is_internal=True, transfer_counterpart__isnull=True
    )


def _count_internal_without_counterpart(household) -> int:
    return _internal_without_counterpart_qs(household).count()


def _find_internal_without_counterpart(household, **window) -> list[Finding]:
    return [
        Finding(
            kind=INTERNAL_WITHOUT_COUNTERPART,
            object_id=str(txn.pk),
            label=f"{txn.booked_on.isoformat()} · {txn.label_raw[:80]}",
            fingerprint=fingerprint_of(INTERNAL_WITHOUT_COUNTERPART, txn.amount),
            detail={
                "account_name": txn.account.name,
                "booked_on": txn.booked_on.isoformat(),
                "label": txn.label_raw,
                "amount": str(txn.amount),
                "direction": txn.direction,
            },
        )
        for txn in apply_window(_internal_without_counterpart_qs(household), **window)
    ]


# --- Recurrences (lot 6) ------------------------------------------------------


def _overdue_recurring_qs(household):
    """Recurrences whose due date has passed with nothing recorded.

    Not cosmetic: ``next_due_date`` feeds the treasury projection and the
    « engagé à venir » of each budget. A due date that never advances makes both
    lie — the app claims money is still committed that has in fact already left,
    or has not left at all because the direct debit was stopped and nobody said so.

    No conformity window here: a recurrence is a *schedule*, not a statement line.
    Its due date being in the past is a fact regardless of which periods have been
    imported.
    """
    from budget.models import RecurringExpense

    return RecurringExpense.objects.filter(
        household=household, next_due_date__lt=date.today()
    )


def _count_overdue_recurring(household) -> int:
    return _overdue_recurring_qs(household).count()


def _find_overdue_recurring(household, **window) -> list[Finding]:
    today = date.today()
    return [
        Finding(
            kind=RECURRING_OVERDUE,
            object_id=str(recurring.pk),
            label=recurring.label,
            # The due date founds the écart: confirming one occurrence advances it,
            # so an arbitration made for « prélèvement arrêté » must be reconsidered
            # if the schedule moves.
            fingerprint=fingerprint_of(RECURRING_OVERDUE, recurring.next_due_date),
            detail={
                "label": recurring.label,
                "amount": str(recurring.amount),
                "next_due_date": recurring.next_due_date.isoformat(),
                "days_late": (today - recurring.next_due_date).days,
                "cadence": recurring.cadence,
            },
        )
        for recurring in apply_window(_overdue_recurring_qs(household), **window)
    ]


def _double_confirmed_pairs(household) -> list[tuple[object, list]]:
    """Recurrences with two occurrences on the same day — a data bug.

    Only possible through two paths racing: a manual confirmation and an import
    confirming the same debit. ``waivable=False`` because there is no motive that
    makes counting one bill twice acceptable; one of the two has to go.

    Grouping is done on the **FK**, which is exactly why it was promoted out of
    ``metadata``: a JSON key can be neither indexed nor grouped in SQL, so this
    detector would have been impossible to write honestly (see CLAUDE.md).
    """
    from django.db.models import Count

    from budget.models import RecurringExpense
    from interactions.models import Interaction

    duplicated = (
        Interaction.objects.filter(
            household=household, recurring_expense__isnull=False, type="expense"
        )
        .values("recurring_expense_id", "occurred_at__date")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
    )

    by_recurrence: dict[str, list[dict]] = {}
    for row in duplicated:
        by_recurrence.setdefault(str(row["recurring_expense_id"]), []).append(
            {"date": row["occurred_at__date"].isoformat(), "count": row["n"]}
        )
    if not by_recurrence:
        return []

    recurrences = RecurringExpense.objects.filter(pk__in=by_recurrence.keys())
    return [(r, by_recurrence[str(r.pk)]) for r in recurrences]


def _count_double_confirmed(household) -> int:
    return len(_double_confirmed_pairs(household))


def _find_double_confirmed(household, *, pks=None, exclude_pks=None, limit=None, offset=None):
    pairs = _double_confirmed_pairs(household)
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
            kind=RECURRING_DOUBLE_CONFIRMED,
            object_id=str(recurring.pk),
            label=recurring.label,
            fingerprint=fingerprint_of(
                RECURRING_DOUBLE_CONFIRMED, len(days), sorted(d["date"] for d in days)
            ),
            detail={"label": recurring.label, "occurrences": days},
        )
        for recurring, days in pairs
    ]


def _negative_cash_pairs(household) -> list[tuple[BankAccount, Decimal]]:
    """Cash accounts showing a negative balance, with the figure.

    Physically impossible: you cannot hand over a note you do not have. So it never
    means "overdraft", it means a withdrawal was never declared — the money left
    the bank account and nobody said it arrived in the pot. Hence
    ``waivable=False``: there is no motive that makes this acceptable, only a
    missing operation to record.

    Python rather than SQL for the same reason as the chain check: the balance is a
    computation (``balances.compute_balance``), and the cost is bounded by the
    number of cash accounts — one, usually.
    """
    from .balances import compute_balance

    pairs = []
    for account in BankAccount.objects.filter(
        household=household, archived=False, kind=BankAccount.Kind.CASH
    ):
        balance = compute_balance(account=account)
        if balance.amount < 0:
            pairs.append((account, balance.amount))
    return pairs


def _count_negative_cash(household) -> int:
    return len(_negative_cash_pairs(household))


def _find_negative_cash(household, *, pks=None, exclude_pks=None, limit=None, offset=None):
    pairs = _negative_cash_pairs(household)
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
            kind=ACCOUNT_CASH_NEGATIVE,
            object_id=str(account.pk),
            label=account.name,
            fingerprint=fingerprint_of(ACCOUNT_CASH_NEGATIVE, amount),
            detail={"name": account.name, "balance": str(amount)},
        )
        for account, amount in pairs
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


def _recurring_model():
    from budget.models import RecurringExpense

    return RecurringExpense


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
            kind=EXPENSE_WITHOUT_BUDGET,
            severity=WARNING,
            label="Expense counting against no budget envelope",
            target="expense",
            model=Interaction,
            count=_count_without_budget,
            findings=_find_without_budget,
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
        DetectorSpec(
            kind=INFLOW_UNCLASSIFIED,
            severity=WARNING,
            label="Receipt nobody has classified",
            target="transaction",
            model=BankTransaction,
            count=_count_unclassified_inflow,
            findings=_find_unclassified_inflow,
            blocked_by=ACCOUNT_NO_OPENING_BALANCE,
        ),
        DetectorSpec(
            kind=INTERNAL_WITHOUT_COUNTERPART,
            severity=ERROR,
            label="Internal movement whose other leg was never recorded",
            target="transaction",
            model=BankTransaction,
            count=_count_internal_without_counterpart,
            findings=_find_internal_without_counterpart,
            blocked_by=ACCOUNT_NO_OPENING_BALANCE,
        ),
        DetectorSpec(
            kind=RECURRING_OVERDUE,
            severity=WARNING,
            label="Recurrence past due with nothing recorded",
            target="recurring",
            model=_recurring_model(),
            count=_count_overdue_recurring,
            findings=_find_overdue_recurring,
        ),
        DetectorSpec(
            kind=RECURRING_DOUBLE_CONFIRMED,
            severity=ERROR,
            label="Recurrence confirmed twice for the same day",
            target="recurring",
            model=_recurring_model(),
            count=_count_double_confirmed,
            findings=_find_double_confirmed,
            # Counting one bill twice is never acceptable — one of the two has to go.
            waivable=False,
        ),
        DetectorSpec(
            kind=ACCOUNT_CASH_NEGATIVE,
            severity=ERROR,
            label="Cash account in the red — a withdrawal was never declared",
            target="account",
            model=BankAccount,
            count=_count_negative_cash,
            findings=_find_negative_cash,
            # No motive makes physically impossible money acceptable. There is an
            # operation missing, not a judgement call to record.
            waivable=False,
        ),
    ]
