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
from datetime import date

from django.db.models import Max

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
