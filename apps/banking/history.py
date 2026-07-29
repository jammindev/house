"""Balance over time — the curve, unwound from the figure already on screen.

The balance card answers « combien ». It cannot answer « depuis quand », « est-ce
que ça descend », « qu'est-ce qui a creusé mars » — those need a shape, and a
shape needs a series.

**The series is not a second computation.** ``banking.balances`` obtains a
balance two different ways — *anchored* on the running balance the bank printed,
or *derived* from ``opening_balance`` plus the movements — and which one applies
depends on the file the user happened to import. A curve redoing that arithmetic
its own way would end on a different number than the one printed right above it:
the « un compteur ne peut pas avoir deux définitions » failure of CLAUDE.md, on
money, in the same viewport.

So the curve is **unwound backwards**: the last point *is* ``compute_balance()``,
and each earlier day is the next day minus that day's movements. The two agree by
construction rather than by coincidence, and no future change to the anchoring
rules can pull them apart. Regression:
``test_balance_history.py::TestTheCurveEndsOnTheDisplayedBalance``.

Two consequences worth keeping in mind:

- **A hole in the chain shifts the entire past of the curve.** Unwinding from a
  trustworthy endpoint means missing money is absorbed *before* the gap, so every
  earlier point is off by the same amount while still looking perfectly plausible.
  That is why ``is_reliable`` and ``gaps`` travel with the points and are rendered,
  not merely returned.
- **A balance is a step function.** It holds until something moves it. Interpolating
  between operations would draw money trickling in over days it did not move, and a
  slope reads as a trend.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Max, Min, Sum

from core.timezones import household_today

from .balances import ChainGap, compute_balance
from .models import BankAccount, BankTransaction

ZERO = Decimal("0.00")

#: Beyond this, daily points stop being a curve and become a smear — and the
#: payload grows for pixels nobody can distinguish. Sampling keeps both ends,
#: which is what makes it honest: the last point stays the displayed balance.
MAX_POINTS = 400


@dataclass(frozen=True)
class BalancePoint:
    """The balance at the **end** of ``on`` — several operations the same day
    collapse into one step, because that is what the account actually did."""

    on: date
    amount: Decimal


@dataclass(frozen=True)
class AccountHistory:
    """One account's curve, carrying how much it can be trusted."""

    account_id: str
    name: str
    kind: str
    points: list[BalancePoint]
    #: ``anchored`` or ``derived`` — the mode ``compute_balance`` used for the
    #: endpoint the whole curve hangs from.
    source: str
    is_reliable: bool
    gaps: list[ChainGap] = field(default_factory=list)


@dataclass(frozen=True)
class HouseholdHistory:
    """Every live account on one shared axis, plus what the household holds."""

    accounts: list[AccountHistory]
    total: list[BalancePoint]
    is_reliable: bool


def balance_series(
    *,
    account: BankAccount,
    start: date | None = None,
    end: date | None = None,
) -> AccountHistory:
    """The balance of ``account``, day by day, over ``[start, end]``.

    ``end`` defaults to today in the household's timezone — or to the last
    operation when a statement books into the future.

    ⚠️ ``start`` is **clamped** to what the account can found: its
    ``opening_balance_date``, or its first operation when it has no opening date.
    Asking for twelve months of an account opened two months ago does not produce
    ten months of flat line — it produces two months. Unwinding backwards past the
    opening date would draw the opening balance held steady over a period House
    knows nothing about, which is the same lie as the household total
    back-projecting an account that did not exist yet. Same principle as the
    conformity window: outside it, we do not assert.
    """
    end = _default_end(account, end)
    start = _effective_start(account, start, end)
    if start > end:
        start = end

    balance = compute_balance(account=account, as_of=end)
    daily = _unwind(account=account, start=start, end=end, final=balance.amount)

    return AccountHistory(
        account_id=str(account.id),
        name=account.name,
        kind=account.kind,
        points=_sample(_days(start, end), daily),
        source=balance.source,
        is_reliable=balance.is_reliable,
        gaps=balance.gaps,
    )


def household_series(
    *,
    household,
    start: date | None = None,
    end: date | None = None,
) -> HouseholdHistory:
    """Every live account on the **same** dates, plus the household total.

    The shared axis is the whole point: two curves sampled independently would
    land on different days and could not be summed, let alone read against each
    other.

    ⚠️ Before an account opens, it contributes **zero** — not its opening balance
    projected backwards. Back-projecting would show the household holding money it
    did not have, and the total is the one figure someone might act on.
    """
    accounts = [
        account
        for account in BankAccount.objects.filter(household=household, archived=False).order_by(
            "name"
        )
        if _has_something_to_draw(account)
    ]
    if not accounts:
        return HouseholdHistory(accounts=[], total=[], is_reliable=True)

    end = end or max(_default_end(account, None) for account in accounts)
    starts = {
        account.id: min(_effective_start(account, start, end), end) for account in accounts
    }
    axis = _days(min(starts.values()), end)
    sampled = _sample_dates(axis)

    series: list[AccountHistory] = []
    for account in accounts:
        balance = compute_balance(account=account, as_of=end)
        daily = _unwind(
            account=account, start=starts[account.id], end=end, final=balance.amount
        )
        series.append(
            AccountHistory(
                account_id=str(account.id),
                name=account.name,
                kind=account.kind,
                # ``ZERO`` outside the account's own window — see the docstring.
                points=[BalancePoint(on=day, amount=daily.get(day, ZERO)) for day in sampled],
                source=balance.source,
                is_reliable=balance.is_reliable,
                gaps=balance.gaps,
            )
        )

    total = [
        BalancePoint(
            on=day,
            amount=sum((s.points[index].amount for s in series), ZERO),
        )
        for index, day in enumerate(sampled)
    ]

    return HouseholdHistory(
        accounts=series,
        total=total,
        is_reliable=all(s.is_reliable for s in series),
    )


def _has_something_to_draw(account: BankAccount) -> bool:
    """An account with neither an opening date nor a line has no curve.

    Plotting it as a flat zero would add a line to the legend that says nothing
    and a series to the total that hides the accounts that do have data.
    """
    if account.opening_balance_date is not None:
        return True
    return BankTransaction.objects.filter(account=account).exists()


def _default_end(account: BankAccount, end: date | None) -> date:
    if end is not None:
        return end
    today = household_today(account.household)
    last = BankTransaction.objects.filter(account=account).aggregate(last=Max("booked_on"))[
        "last"
    ]
    return max(today, last) if last else today


def _effective_start(account: BankAccount, start: date | None, end: date) -> date:
    """The later of what was asked for and what the account can found.

    The natural start is ``opening_balance_date``, or the first operation when
    there is none: before the first line, nothing establishes a balance, and
    starting from zero would invent an overdraft that never happened.
    """
    natural = account.opening_balance_date
    if natural is None:
        natural = BankTransaction.objects.filter(account=account).aggregate(
            first=Min("booked_on")
        )["first"]
    if natural is None:
        return start or end
    return max(natural, start) if start is not None else natural


def _unwind(
    *, account: BankAccount, start: date, end: date, final: Decimal
) -> dict[date, Decimal]:
    """Walk the movements backwards from ``final`` to fill every day in range.

    One query: the days that actually moved. Everything between them repeats the
    previous value, which is the staircase — not an approximation of it.
    """
    deltas = {
        row["booked_on"]: row["delta"]
        for row in BankTransaction.objects.filter(
            account=account, booked_on__gt=start, booked_on__lte=end
        )
        .values("booked_on")
        .annotate(delta=Sum("amount"))
    }

    balances: dict[date, Decimal] = {}
    running = final
    day = end
    while day >= start:
        balances[day] = running
        # The balance at the end of the previous day is this one minus whatever
        # moved today — ``day`` itself is already accounted for in ``running``.
        running = running - deltas.get(day, ZERO)
        day -= timedelta(days=1)
    return balances


def _days(start: date, end: date) -> list[date]:
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def _sample_dates(days: list[date]) -> list[date]:
    """Thin a long axis, keeping the **last** day whatever happens.

    Sampling from the end rather than the start is deliberate: the final point is
    the displayed balance, and dropping it to keep a round stride would break the
    only property this module guarantees.
    """
    if len(days) <= MAX_POINTS:
        return days
    stride = -(-len(days) // (MAX_POINTS - 1))  # ceil
    kept = list(reversed(days[::-1][::stride]))
    if kept[0] != days[0]:
        kept.insert(0, days[0])
    return kept


def _sample(days: list[date], daily: dict[date, Decimal]) -> list[BalancePoint]:
    return [BalancePoint(on=day, amount=daily[day]) for day in _sample_dates(days)]


def serialize_history(history: AccountHistory) -> dict:
    """API shape. Decimals become strings, as everywhere else in the project."""
    return {
        "account_id": history.account_id,
        "name": history.name,
        "kind": history.kind,
        "source": history.source,
        "is_reliable": history.is_reliable,
        "points": [{"on": p.on.isoformat(), "amount": str(p.amount)} for p in history.points],
    }


def serialize_household_history(history: HouseholdHistory) -> dict:
    return {
        "is_reliable": history.is_reliable,
        "accounts": [serialize_history(series) for series in history.accounts],
        "total": [{"on": p.on.isoformat(), "amount": str(p.amount)} for p in history.total],
    }
