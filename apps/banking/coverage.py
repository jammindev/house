"""The conformity horizon — the window inside which an écart is a real écart.

Without this module the compliance control would be unusable on day one. A
household that starts using House in July has years of expenses typed in before
it: none of them has a bank line to be reconciled with, and none ever will.
Flagging them would show hundreds of structurally unfixable écarts, and the only
rational response to an unfixable list is to stop reading it.

So conformity is **bounded**, per account::

    [opening_balance_date, last date we hold a statement for]

- **before** the opening balance: history, out of scope — never an écart;
- **after** the last statement: no statement yet, which is normal — yesterday's
  expense is not an orphan;
- **between the two**: the requirement is total. That is what makes "zéro écart"
  reachable, and therefore worth aiming at.

An account with no ``opening_balance_date`` has **no window at all**: nothing can
be asserted about it, so dependent detectors skip it entirely and the missing
opening balance is reported on its own as a blocking prerequisite. Fixing one
field then makes the rest of the control meaningful — one action instead of nine
hundred.

This is the ONE place the window is computed. Detectors of lots 1, 5, 6 and 7 all
read it from here.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import Count, Max, Min

from .models import BankAccount, BankTransaction, ImportStatus, StatementImport


@dataclass(frozen=True)
class Window:
    """A closed date interval inside which conformity is required."""

    start: date
    end: date

    def contains(self, day: date) -> bool:
        return self.start <= day <= self.end


#: Why an account has no conformity window. ``""`` means it has one.
WINDOW_OK = ""
#: No starting point at all — the original blocking prerequisite.
NO_OPENING_DATE = "no_opening_date"
#: A starting point, but **later than every line we hold**. The nastiest case: the
#: date is filled, so the old detector stayed silent, while the window excluded all
#: the data as "history". Everything then read « conforme » with nothing checked.
OPENING_DATE_AFTER_DATA = "opening_date_after_data"
#: Nothing imported yet. Not a problem — a fresh account has nothing to assert.
NO_DATA = "no_data"


def window_status(account) -> tuple[str, Window | None]:
    """Why this account has (or has not) a conformity window.

    Split out from :func:`covered_period` because the *reason* matters: an account
    with no data is fine, whereas an account whose opening date postdates its own
    statements is invisible to every control — and must say so. Returning only
    ``None`` made those two indistinguishable, which is how the silent case shipped.
    """
    start = account.opening_balance_date
    end = _latest_known_date(account)

    if start is None:
        return (NO_OPENING_DATE, None)
    if end is None:
        return (NO_DATA, None)
    if end < start:
        return (OPENING_DATE_AFTER_DATA, None)
    return (WINDOW_OK, Window(start=start, end=end))


def covered_period(account) -> Window | None:
    """Conformity window of ``account``, or ``None`` when it has none.

    The end of the window is the latest of two claims:

    - the ``period_end`` of its completed imports — the honest statement of how
      far the bank's own record goes;
    - the ``booked_on`` of its newest transaction — the only signal a cash
      account has, since money typed straight onto it comes with no import.

    Returns ``None`` when the account has no opening balance date (nothing can be
    asserted) or holds nothing at all (nothing to assert about).
    """
    return window_status(account)[1]


def _latest_known_date(account) -> date | None:
    from_imports = (
        StatementImport.objects.filter(
            account=account, status=ImportStatus.COMPLETED
        ).aggregate(latest=Max("period_end"))["latest"]
    )
    from_lines = BankTransaction.objects.filter(account=account).aggregate(
        latest=Max("booked_on")
    )["latest"]

    candidates = [d for d in (from_imports, from_lines) if d is not None]
    return max(candidates) if candidates else None


def serialize_coverage(account) -> dict:
    """What the control can assert about ``account`` — and otherwise why it cannot.

    Exists for the account page, and it carries the ``status`` rather than just the
    two bounds for the reason stated at the top of this module: a window of ``None``
    has three completely different meanings (no starting point, a starting point
    later than the data, nothing imported yet), and only the first two are problems.
    A page that rendered them all as "not covered" would repeat the bug the
    ``window_status`` split was introduced to kill.

    ``first_line`` / ``last_line`` are what makes the second case *readable*: « ta
    date de solde d'ouverture est postérieure à ta plus ancienne opération » cannot
    be said without naming that operation's date.
    """
    status, window = window_status(account)
    lines = BankTransaction.objects.filter(account=account).aggregate(
        first=Min("booked_on"), last=Max("booked_on"), total=Count("pk")
    )
    return {
        "status": status,
        "start": window.start.isoformat() if window else None,
        "end": window.end.isoformat() if window else None,
        # Bornées à la fenêtre quand il y en a une : une période manquante hors
        # fenêtre n'est pas un écart, et l'annoncer ferait une liste irrésoluble.
        "gaps": period_gaps(account, between=window),
        "first_line": lines["first"].isoformat() if lines["first"] else None,
        "last_line": lines["last"].isoformat() if lines["last"] else None,
        "transaction_count": lines["total"],
    }


def period_gaps(account, *, between: Window | None = None) -> list[dict]:
    """Calendar holes between the periods this account has actually imported.

    Only ``completed`` imports count: a failed one wrote nothing, so claiming its
    period would be a lie. Overlapping periods are fine — re-importing a month is
    the normal way to catch up — so only a **strictly positive** gap is reported.

    ``between`` narrows the answer to the holes that overlap a given interval. The
    balance reconstruction needs exactly that: money missing in February says
    nothing about a balance reconstructed over June–July, and refusing the
    reconstruction for it would be the unfixable-écart mistake all over again.
    """
    periods = list(
        StatementImport.objects.filter(
            account=account,
            status=ImportStatus.COMPLETED,
            period_start__isnull=False,
            period_end__isnull=False,
        )
        .order_by("period_start")
        .values_list("period_start", "period_end")
    )
    if len(periods) < 2:
        return []

    gaps: list[dict] = []
    covered_to = periods[0][1]
    for start, end in periods[1:]:
        if start > covered_to + timedelta(days=1):
            gap_start = covered_to + timedelta(days=1)
            gap_end = start - timedelta(days=1)
            if between is None or (gap_start <= between.end and gap_end >= between.start):
                gaps.append(
                    {
                        "gap_start": gap_start.isoformat(),
                        "gap_end": gap_end.isoformat(),
                        "days": (gap_end - gap_start).days + 1,
                    }
                )
        covered_to = max(covered_to, end)

    return gaps


def accounts_with_window(household) -> list[tuple[BankAccount, Window]]:
    """Every non-archived account of ``household`` that has a window, with it.

    Detectors iterate this instead of all accounts: an account without a window
    is not "conforme", it is **not evaluable**, and its own detector says so.
    """
    pairs = []
    for account in BankAccount.objects.filter(household=household, archived=False):
        window = covered_period(account)
        if window is not None:
            pairs.append((account, window))
    return pairs


def household_covered_period(household) -> Window | None:
    """Union of the accounts' windows — the horizon for account-less entities.

    An ``Interaction`` is not attached to an account, so "is this expense inside
    a period we hold statements for?" can only be answered household-wide. The
    union is deliberately the widest reading: an expense is flagged as
    unreconciled as soon as *some* account was being tracked when it happened.
    Narrowing it per account would require guessing which account paid, which is
    exactly the fact we are missing.
    """
    windows = [window for _, window in accounts_with_window(household)]
    if not windows:
        return None
    return Window(
        start=min(w.start for w in windows),
        end=max(w.end for w in windows),
    )
