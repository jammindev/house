"""Banking's own compliance detectors — most of the orphan catalogue.

Each one answers a question the household would otherwise have to ask itself, and
would therefore never ask:

- money left the account and nobody said what for (``transaction_unallocated``);
- money left and only part of it was accounted for (``transaction_partial``);
- an expense was typed in that the bank never saw (``expense_unreconciled``);
- an expense that counts against no envelope (``expense_without_budget``);
- an account the control cannot reach at all (``account_without_window``);
- an account whose statements do not chain (``account_chain_broken``);
- a cash account in the red, which is physically impossible (``account_cash_negative``);
- a receipt nobody classified (``inflow_unclassified``);
- an internal movement whose other leg is missing (``internal_without_counterpart``);
- a recurrence past due with nothing recorded (``recurring_overdue``);
- a recurrence confirmed twice for the same day (``recurring_double_confirmed``);
- a period nobody ever imported (``statement_period_gap``);
- lines skipped where the dedup recipe cannot be trusted (``import_skipped_lines``);
- a reconstructed opening balance whose arithmetic stopped closing
  (``account_anchor_stale``).

Every detector that reasons about "money we should know about" is scoped by
``banking.coverage``: outside the conformity window an écart is not an écart, it
is history or it is tomorrow. That scoping is what makes zero reachable.

Registered from ``banking.apps.BankingConfig.ready()``.
"""
from __future__ import annotations

from decimal import Decimal

from django.db.models import F, Q

from core.timezones import household_today

from .balances import check_balance_chain
from .compliance import (
    BLOCKER,
    ERROR,
    WARNING,
    DetectorSpec,
    Finding,
    apply_window,
    apply_window_to_pairs,
    fingerprint_of,
    get_detector,
    register,
)
from .coverage import accounts_with_window, household_covered_period, period_gaps
from .models import BankAccount, BankTransaction, ImportStatus
from .queries import with_allocation

#: Kind keys — imported by tests and by the services layer, never retyped.
TRANSACTION_UNALLOCATED = "transaction_unallocated"
TRANSACTION_PARTIAL = "transaction_partially_allocated"
EXPENSE_UNRECONCILED = "expense_unreconciled"
EXPENSE_WITHOUT_BUDGET = "expense_without_budget"
ACCOUNT_WITHOUT_WINDOW = "account_without_window"
ACCOUNT_CHAIN_BROKEN = "account_chain_broken"
ACCOUNT_CASH_NEGATIVE = "account_cash_negative"
INFLOW_UNCLASSIFIED = "inflow_unclassified"
INTERNAL_WITHOUT_COUNTERPART = "internal_without_counterpart"
RECURRING_OVERDUE = "recurring_overdue"
RECURRING_DOUBLE_CONFIRMED = "recurring_double_confirmed"
STATEMENT_PERIOD_GAP = "statement_period_gap"
IMPORT_SKIPPED_LINES = "import_skipped_lines"
ACCOUNT_ANCHOR_STALE = "account_anchor_stale"


# --- Shared base: spendable outflows inside their account's window -----------


def _window_scope(household) -> Q:
    """``Q`` matching every line inside its own account's conformity window.

    Matches nothing when no account has a window at all: nothing can be asserted,
    and the prerequisite detector is the one doing the talking. That case is an
    impossible ``Q``, not ``.none()`` — an ``EmptyQuerySet`` carries no annotations,
    so callers filtering on ``allocated`` would hit a ``FieldError`` instead of
    getting zero rows.
    """
    scope = Q(pk__in=[])
    for account, window in accounts_with_window(household):
        scope |= Q(account=account, booked_on__gte=window.start, booked_on__lte=window.end)
    return scope


def _scoped_lines(household):
    """Every line inside its account's conformity window, unfiltered otherwise."""
    return (
        BankTransaction.objects.filter(household=household)
        .filter(_window_scope(household))
        .select_related("account")
    )


def _allocatable_outflows(household):
    """Outgoing operations the household is expected to account for.

    Excluded, and each for its own reason:

    - inflows: a receipt is not spending (its own detector lands in lot 5);
    - internal movements and their counterparts: the money is counted once, later,
      when the cash they fed is actually spent — allocating them would double it,
      which is the same rule ``validators.assert_allocation_fits`` enforces;
    - anything outside its account's conformity window.
    """
    # ``with_allocation`` is shared with the journal badge on purpose: the count
    # on the Contrôle tab and the marker on the line must be the same judgement.
    return with_allocation(
        _scoped_lines(household).filter(
            amount__lt=0, is_internal=False, transfer_counterpart__isnull=True
        )
    )


def pending_outflows(household):
    """Les lignes que le contrôle réclame — non ventilées **et** partielles.

    Union exacte des deux détecteurs de rangement, exprimée une fois : le journal
    l'utilise pour son filtre « à traiter », le Contrôle pour ses compteurs. Un
    filtre qui recalculerait son propre critère finirait par montrer une liste
    dont le nombre de lignes ne tombe pas d'accord avec le badge juste au-dessus —
    et c'est précisément ce que la règle « jamais deux voix » interdit.

    ``allocated < outflow_value`` couvre les deux cas d'un coup : zéro alloué, et
    partiellement alloué.
    """
    return _allocatable_outflows(household).filter(allocated__lt=F("outflow_value"))


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


def _accounts_without_window(household) -> list[tuple[BankAccount, str]]:
    """Accounts that **hold data** but have no conformity window, with the reason.

    Two reasons matter, and conflating them is what let a silent failure ship:

    - ``no_opening_date`` — no starting point at all;
    - ``opening_date_after_data`` — a starting point **later than every line held**.
      The date is filled, so the original detector stayed quiet, while the window
      excluded all the statement as "history". Every control then read « conforme »
      with nothing actually checked — the exact silent orphan this parcours forbids.

    An account with **no data** is deliberately not reported: a freshly declared
    account has nothing to assert about, and nagging about it would be the busywork
    that makes a control panel stop being read.
    """
    from .coverage import NO_DATA, WINDOW_OK, window_status

    pairs = []
    for account in BankAccount.objects.filter(household=household, archived=False):
        reason, _ = window_status(account)
        if reason in (WINDOW_OK, NO_DATA):
            continue
        pairs.append((account, reason))
    return pairs


def _count_without_window(household) -> int:
    return len(_accounts_without_window(household))


def _find_without_window(household, *, pks=None, exclude_pks=None, limit=None, offset=None):
    pairs = _accounts_without_window(household)
    pairs = apply_window_to_pairs(
        pairs, pks=pks, exclude_pks=exclude_pks, limit=limit, offset=offset
    )

    return [
        Finding(
            kind=ACCOUNT_WITHOUT_WINDOW,
            object_id=str(account.pk),
            label=account.name,
            # The reason is part of what founds the écart: moving from « no date » to
            # « date after data » is a different problem needing a different fix.
            fingerprint=fingerprint_of(ACCOUNT_WITHOUT_WINDOW, reason),
            detail={
                "name": account.name,
                "kind": account.kind,
                "reason": reason,
                "opening_balance_date": (
                    account.opening_balance_date.isoformat()
                    if account.opening_balance_date
                    else None
                ),
                "earliest_line": _earliest_line_date(account),
            },
        )
        for account, reason in pairs
    ]


def _earliest_line_date(account) -> str | None:
    """Oldest line held, so the UI can propose the date that would fix it."""
    from django.db.models import Min

    oldest = BankTransaction.objects.filter(account=account).aggregate(
        oldest=Min("booked_on")
    )["oldest"]
    return oldest.isoformat() if oldest else None


# --- Receipts and internal movements (lot 5) ---------------------------------


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


# --- Statement continuity and provenance (lot 7) ------------------------------


def _period_gap_pairs(household) -> list[tuple[BankAccount, list[dict]]]:
    """Accounts with a hole between two consecutive imported periods.

    The balance chain check catches missing operations *inside* an imported period,
    by arithmetic. This catches the other half: a period nobody ever imported. The
    two are complementary and neither sees the other's blind spot — a February
    that was never dropped in leaves no arithmetic trace at all, only a gap in the
    calendar.

    The gap arithmetic itself lives in ``coverage.period_gaps``: the balance
    reconstruction needs the same answer scoped to an interval, and two
    implementations of "which periods are missing" would drift apart.
    """
    pairs = []
    for account in BankAccount.objects.filter(household=household, archived=False):
        gaps = period_gaps(account)
        if gaps:
            pairs.append((account, gaps))
    return pairs


def _count_period_gaps(household) -> int:
    return len(_period_gap_pairs(household))


def _find_period_gaps(household, *, pks=None, exclude_pks=None, limit=None, offset=None):
    pairs = _period_gap_pairs(household)
    pairs = apply_window_to_pairs(
        pairs, pks=pks, exclude_pks=exclude_pks, limit=limit, offset=offset
    )

    return [
        Finding(
            kind=STATEMENT_PERIOD_GAP,
            object_id=str(account.pk),
            label=account.name,
            # The missing days found the écart: importing part of the hole must
            # invalidate an arbitration that accepted the whole of it.
            fingerprint=fingerprint_of(
                STATEMENT_PERIOD_GAP, sorted(g["gap_start"] for g in gaps)
            ),
            detail={
                "name": account.name,
                "gap_count": len(gaps),
                "missing_days": sum(g["days"] for g in gaps),
                "gaps": gaps,
            },
        )
        for account, gaps in pairs
    ]


def _skipped_lines_qs(household):
    """Imports that skipped lines on a file with neither reference nor balance.

    ``skipped_count > 0`` is normally the good news — it is what a re-import looks
    like. It becomes a warning **only** on a file carrying neither a bank reference
    nor a running balance, because that is exactly the documented limit of the
    dedup recipe (``docs/fiches/IMPORT_ET_RAPPROCHEMENT.md`` §3.2): the discriminant
    falls back to an in-file occurrence index, so a later *partial* export of an
    identical line can be skipped as a duplicate when it is genuinely new.

    Whether the file had those columns is derived from the rows it created rather
    than stored: a column that produced no value on any line was, for dedup
    purposes, absent — which is the property that actually matters here.
    """
    from django.db.models import Count, Q as _Q

    from .models import StatementImport

    return (
        StatementImport.objects.filter(
            household=household, status=ImportStatus.COMPLETED, skipped_count__gt=0
        )
        .annotate(
            with_reference=Count(
                "transactions", filter=~_Q(transactions__external_id=""), distinct=True
            ),
            with_balance=Count(
                "transactions",
                filter=_Q(transactions__balance_after__isnull=False),
                distinct=True,
            ),
        )
        .filter(with_reference=0, with_balance=0)
        .select_related("account")
    )


def _count_skipped_lines(household) -> int:
    return _skipped_lines_qs(household).count()


def _find_skipped_lines(household, **window) -> list[Finding]:
    return [
        Finding(
            kind=IMPORT_SKIPPED_LINES,
            object_id=str(imported.pk),
            label=f"{imported.filename or imported.provider} · {imported.account.name}",
            fingerprint=fingerprint_of(IMPORT_SKIPPED_LINES, imported.skipped_count),
            detail={
                "filename": imported.filename,
                "account_name": imported.account.name,
                "skipped_count": imported.skipped_count,
                "created_count": imported.created_count,
                "created_at": imported.created_at.isoformat(),
            },
        )
        for imported in apply_window(_skipped_lines_qs(household), **window)
    ]


def _stale_anchor_pairs(household) -> list[tuple[BankAccount, Decimal]]:
    """Accounts whose reconstructed opening balance no longer adds up.

    When the bank exports no balance column, the opening balance is reconstructed
    by subtracting the movements from a balance the user read (see
    :mod:`banking.anchoring`). That subtraction is exact only while the lines
    underneath stay put. Import a forgotten week *inside* the interval and the
    reconstruction is short by exactly that week — every balance the account shows
    is then wrong by a constant, and on a file with no balance column the chain
    check has nothing to catch it with.

    So the attestation is re-verified rather than trusted: opening balance plus
    movements up to the attested date must still equal the attested balance. This
    is the third leg of the continuity family — ``account_chain_broken`` for banks
    that print balances, ``statement_period_gap`` for periods never imported, this
    one for the reconstruction those two cannot see.

    Iterated in Python on purpose: only accounts carrying an attestation are
    concerned, which is a handful per household, and the check is a sum over an
    indexed range.
    """
    from .anchoring import attestation_drift

    pairs = []
    for account in BankAccount.objects.filter(
        household=household, archived=False, attested_on__isnull=False
    ):
        drift = attestation_drift(account)
        if drift is not None and drift != Decimal("0.00"):
            pairs.append((account, drift))
    return pairs


def _count_stale_anchors(household) -> int:
    return len(_stale_anchor_pairs(household))


def _find_stale_anchors(household, *, pks=None, exclude_pks=None, limit=None, offset=None):
    pairs = _stale_anchor_pairs(household)
    pairs = apply_window_to_pairs(
        pairs, pks=pks, exclude_pks=exclude_pks, limit=limit, offset=offset
    )

    return [
        Finding(
            kind=ACCOUNT_ANCHOR_STALE,
            object_id=str(account.pk),
            label=account.name,
            fingerprint=fingerprint_of(ACCOUNT_ANCHOR_STALE, drift),
            detail={
                "name": account.name,
                "drift": str(drift),
                "attested_balance": str(account.attested_balance),
                "attested_on": account.attested_on.isoformat(),
                "computed_balance": str(account.attested_balance + drift),
            },
        )
        for account, drift in pairs
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

    « Aujourd'hui » se lit **chez le foyer**, jamais avec ``date.today()`` : ce
    dernier lit l'horloge du serveur (UTC en conteneur), donc un foyer à Paris
    voyait une échéance basculer « en retard » deux heures trop tôt — et le
    Contrôle comptait autre chose que la liste « échéances dues », qui utilisait
    déjà le bon fuseau.
    """
    from budget.models import RecurringExpense

    return RecurringExpense.objects.filter(
        household=household, next_due_date__lt=household_today(household)
    )


def _count_overdue_recurring(household) -> int:
    return _overdue_recurring_qs(household).count()


def _find_overdue_recurring(household, **window) -> list[Finding]:
    today = household_today(household)
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
    pairs = apply_window_to_pairs(
        pairs, pks=pks, exclude_pks=exclude_pks, limit=limit, offset=offset
    )

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
    pairs = apply_window_to_pairs(
        pairs, pks=pks, exclude_pks=exclude_pks, limit=limit, offset=offset
    )

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
    pairs = apply_window_to_pairs(
        pairs, pks=pks, exclude_pks=exclude_pks, limit=limit, offset=offset
    )

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


def _statement_import_model():
    from .models import StatementImport

    return StatementImport


def _specs() -> list[DetectorSpec]:
    """Declared in the order the control panel should read them: the blocking
    prerequisite first, because it is what makes the others meaningful."""
    from interactions.models import Interaction

    return [
        DetectorSpec(
            kind=ACCOUNT_WITHOUT_WINDOW,
            severity=BLOCKER,
            label="Account outside the control's reach — no conformity window",
            target="account",
            model=BankAccount,
            count=_count_without_window,
            findings=_find_without_window,
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
            blocked_by=ACCOUNT_WITHOUT_WINDOW,
        ),
        DetectorSpec(
            kind=TRANSACTION_PARTIAL,
            severity=ERROR,
            label="Outgoing operation only partly accounted for",
            target="transaction",
            model=BankTransaction,
            count=_count_partial,
            findings=_find_partial,
            blocked_by=ACCOUNT_WITHOUT_WINDOW,
        ),
        DetectorSpec(
            kind=EXPENSE_UNRECONCILED,
            severity=WARNING,
            label="Expense the bank statements never confirmed",
            target="expense",
            model=Interaction,
            count=_count_unreconciled,
            findings=_find_unreconciled,
            blocked_by=ACCOUNT_WITHOUT_WINDOW,
        ),
        DetectorSpec(
            kind=EXPENSE_WITHOUT_BUDGET,
            severity=WARNING,
            label="Expense counting against no budget envelope",
            target="expense",
            model=Interaction,
            count=_count_without_budget,
            findings=_find_without_budget,
            blocked_by=ACCOUNT_WITHOUT_WINDOW,
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
            blocked_by=ACCOUNT_WITHOUT_WINDOW,
        ),
        DetectorSpec(
            kind=INTERNAL_WITHOUT_COUNTERPART,
            severity=ERROR,
            label="Internal movement whose other leg was never recorded",
            target="transaction",
            model=BankTransaction,
            count=_count_internal_without_counterpart,
            findings=_find_internal_without_counterpart,
            blocked_by=ACCOUNT_WITHOUT_WINDOW,
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
            kind=STATEMENT_PERIOD_GAP,
            severity=ERROR,
            label="A period nobody ever imported",
            target="account",
            model=BankAccount,
            count=_count_period_gaps,
            findings=_find_period_gaps,
        ),
        DetectorSpec(
            kind=IMPORT_SKIPPED_LINES,
            severity=WARNING,
            label="Lines skipped on a file with neither reference nor balance",
            target="import",
            model=_statement_import_model(),
            count=_count_skipped_lines,
            findings=_find_skipped_lines,
        ),
        DetectorSpec(
            kind=ACCOUNT_ANCHOR_STALE,
            severity=ERROR,
            label="Reconstructed opening balance no longer adds up",
            target="account",
            model=BankAccount,
            count=_count_stale_anchors,
            findings=_find_stale_anchors,
            # Not a judgement call: the user attested a balance and the arithmetic
            # now contradicts it. Either a statement is missing or the reading was
            # wrong — accepting the contradiction would leave every balance on the
            # account silently off by the drift.
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
