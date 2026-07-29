# banking/tests/test_balance_history.py
"""The balance curve — and the one property that makes it trustworthy.

A balance is never stored (``banking.balances``) and it is obtained two
different ways: *anchored* on the bank's own running balance, or *derived* from
the opening balance plus the movements. A curve that redid that arithmetic its
own way would end on a different figure than the big number printed right above
it — the « un compteur ne peut pas avoir deux définitions » failure of CLAUDE.md,
applied to money.

So the curve is not recomputed, it is **unwound**: the last point *is*
``compute_balance()``, and every earlier point is obtained by subtracting the
day's movements going backwards. The agreement is true by construction, and
:class:`TestTheCurveEndsOnTheDisplayedBalance` is what keeps it that way.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest

from banking.balances import ANCHORED, DERIVED, compute_balance
from banking.dedup import compute_dedup_hash
from banking.history import balance_series, household_series
from banking.models import BankAccount, BankTransaction, TransactionDirection

from .factories import BankAccountFactory, HouseholdFactory

_counter = itertools.count()


def make_txn(account, *, amount, booked_on, balance_after=None, line_no=0, label="OP"):
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=booked_on,
        label_raw=label,
        label_norm=label.upper(),
        amount=value,
        direction=TransactionDirection.OUT if value < 0 else TransactionDirection.IN,
        balance_after=Decimal(balance_after) if balance_after is not None else None,
        line_no=line_no,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=booked_on,
            label_norm=label.upper(),
            amount=value,
            currency="EUR",
            discriminant=f"#{next(_counter)}",
        ),
    )


@pytest.fixture
def household(db):
    return HouseholdFactory()


@pytest.fixture
def account(household):
    return BankAccountFactory(
        household=household,
        opening_balance=Decimal("1000.00"),
        opening_balance_date=date(2026, 1, 1),
    )


def at(history, day: date) -> Decimal:
    """The curve's value on ``day`` — fails loudly if the day is not plotted."""
    for point in history.points:
        if point.on == day:
            return point.amount
    raise AssertionError(f"{day} is not on the curve: {[p.on for p in history.points]}")


@pytest.mark.django_db
class TestTheCurveEndsOnTheDisplayedBalance:
    """⚠️ The regression that matters.

    Two screens showing two different balances for the same account — the card's
    number and the curve's last point — would make both unbelievable. The curve
    must therefore *finish* on ``compute_balance()``, whichever of the two modes
    that call happened to use.
    """

    def test_in_derived_mode(self, account):
        """No balance column in the file: opening balance + movements."""
        make_txn(account, amount="-120.00", booked_on=date(2026, 3, 4))
        make_txn(account, amount="250.00", booked_on=date(2026, 3, 20))

        displayed = compute_balance(account=account)
        history = balance_series(account=account, end=date(2026, 4, 30))

        assert displayed.source == DERIVED
        assert history.points[-1].amount == displayed.amount
        assert history.points[-1].amount == Decimal("1130.00")

    def test_in_anchored_mode(self, account):
        """The bank printed its own running balance — the curve must honour it.

        Note the opening balance is deliberately *inconsistent* with the printed
        one (1000 + movements would give 880, the bank says 2000). A curve doing
        its own arithmetic would end on 880 while the card shows 2000.
        """
        make_txn(account, amount="-120.00", booked_on=date(2026, 3, 4), balance_after="2120.00")
        make_txn(account, amount="-120.00", booked_on=date(2026, 3, 20), balance_after="2000.00")

        displayed = compute_balance(account=account)
        history = balance_series(account=account, end=date(2026, 4, 30))

        assert displayed.source == ANCHORED
        assert history.points[-1].amount == displayed.amount == Decimal("2000.00")

    def test_with_movements_after_the_last_anchor(self, account):
        """A balance-less file imported on top of one that had balances."""
        make_txn(account, amount="-120.00", booked_on=date(2026, 3, 4), balance_after="2120.00")
        make_txn(account, amount="-20.00", booked_on=date(2026, 3, 25))

        displayed = compute_balance(account=account)
        history = balance_series(account=account, end=date(2026, 4, 30))

        assert history.points[-1].amount == displayed.amount == Decimal("2100.00")

    def test_on_an_account_with_no_operation_at_all(self, account):
        """A flat line on the opening balance — not an empty chart, not a zero."""
        history = balance_series(account=account, end=date(2026, 3, 31))

        assert history.points
        assert history.points[-1].amount == compute_balance(account=account).amount
        assert {p.amount for p in history.points} == {Decimal("1000.00")}


@pytest.mark.django_db
class TestTheCurveIsAStaircase:
    """A balance holds until something moves it. It is never interpolated.

    Interpolating would draw money arriving gradually over the days between two
    operations — a slope that never happened, and that reads as a trend.
    """

    def test_a_day_without_operation_keeps_the_previous_balance(self, account):
        make_txn(account, amount="-100.00", booked_on=date(2026, 2, 10))

        history = balance_series(account=account, end=date(2026, 2, 28))

        assert at(history, date(2026, 2, 9)) == Decimal("1000.00")
        assert at(history, date(2026, 2, 10)) == Decimal("900.00")
        assert at(history, date(2026, 2, 11)) == Decimal("900.00")
        assert at(history, date(2026, 2, 28)) == Decimal("900.00")

    def test_a_point_is_the_balance_at_the_end_of_its_day(self, account):
        """Several operations the same day collapse into one step, not several."""
        make_txn(account, amount="-100.00", booked_on=date(2026, 2, 10), line_no=1)
        make_txn(account, amount="-50.00", booked_on=date(2026, 2, 10), line_no=2)

        history = balance_series(account=account, end=date(2026, 2, 12))

        assert at(history, date(2026, 2, 9)) == Decimal("1000.00")
        assert at(history, date(2026, 2, 10)) == Decimal("850.00")


@pytest.mark.django_db
class TestTheCurveStartsWhereTheAccountDoes:
    def test_it_starts_on_the_opening_balance_date(self, account):
        make_txn(account, amount="-100.00", booked_on=date(2026, 2, 10))

        history = balance_series(account=account, end=date(2026, 2, 28))

        assert history.points[0].on == date(2026, 1, 1)
        assert history.points[0].amount == Decimal("1000.00")

    def test_without_an_opening_date_it_starts_on_the_first_operation(self, household):
        """Nothing founds a balance before the first line — so nothing is drawn."""
        account = BankAccountFactory(
            household=household, opening_balance=Decimal("0.00"), opening_balance_date=None
        )
        make_txn(account, amount="-100.00", booked_on=date(2026, 2, 10))

        history = balance_series(account=account, end=date(2026, 2, 28))

        assert history.points[0].on == date(2026, 2, 10)

    def test_a_window_reaching_before_the_opening_date_is_clamped(self, account):
        """⚠️ Twelve months asked of a two-month-old account gives two months.

        Unwinding past the opening date would hold the opening balance flat over
        a period House knows nothing about — the same lie as back-projecting an
        account into a household total before it existed.
        """
        make_txn(account, amount="-100.00", booked_on=date(2026, 2, 10))

        history = balance_series(
            account=account, start=date(2025, 3, 1), end=date(2026, 2, 28)
        )

        assert history.points[0].on == date(2026, 1, 1)

    def test_an_explicit_start_wins_and_the_curve_still_ends_right(self, account):
        """Zooming on a period must not turn the last point into a partial sum."""
        make_txn(account, amount="-100.00", booked_on=date(2026, 2, 10))
        make_txn(account, amount="-40.00", booked_on=date(2026, 4, 3))

        history = balance_series(account=account, start=date(2026, 4, 1), end=date(2026, 4, 30))

        assert history.points[0].on == date(2026, 4, 1)
        assert history.points[0].amount == Decimal("900.00")
        assert history.points[-1].amount == compute_balance(account=account).amount


@pytest.mark.django_db
class TestTheCurveSaysWhenItCannotBeTrusted:
    """A hole in the chain shifts the whole past of the curve, silently.

    Unwinding backwards from a trustworthy last point means the missing money is
    absorbed *before* the gap: every earlier point is off by the same amount. The
    figure stays plausible, which is exactly why the flag has to travel with it.
    """

    def test_a_chain_gap_makes_the_history_unreliable(self, account):
        make_txn(account, amount="-10.00", booked_on=date(2026, 3, 1), balance_after="990.00")
        # 990 - 20 = 970, but the bank prints 500: 470 € of operations are missing.
        make_txn(account, amount="-20.00", booked_on=date(2026, 3, 10), balance_after="500.00")

        history = balance_series(account=account, end=date(2026, 3, 31))

        assert history.is_reliable is False
        assert len(history.gaps) == 1

    def test_a_clean_chain_is_reliable(self, account):
        make_txn(account, amount="-10.00", booked_on=date(2026, 3, 1), balance_after="990.00")
        make_txn(account, amount="-20.00", booked_on=date(2026, 3, 10), balance_after="970.00")

        history = balance_series(account=account, end=date(2026, 3, 31))

        assert history.is_reliable is True
        assert history.gaps == []


@pytest.mark.django_db
class TestTheCurveStaysReadable:
    def test_a_long_window_is_sampled_not_truncated(self, account):
        """Five years of daily points is a smear. Sampling keeps both ends."""
        make_txn(account, amount="-100.00", booked_on=date(2028, 6, 1))

        history = balance_series(account=account, start=date(2026, 1, 1), end=date(2030, 12, 31))

        assert len(history.points) <= 400
        assert history.points[0].on == date(2026, 1, 1)
        assert history.points[-1].on == date(2030, 12, 31)
        assert history.points[-1].amount == compute_balance(account=account).amount


@pytest.mark.django_db
class TestTheHouseholdCurve:
    """All accounts on one axis, plus the total the household actually holds."""

    def test_every_account_shares_the_same_dates(self, household):
        first = BankAccountFactory(
            household=household,
            name="Courant",
            opening_balance=Decimal("500.00"),
            opening_balance_date=date(2026, 1, 1),
        )
        second = BankAccountFactory(
            household=household,
            name="Livret",
            opening_balance=Decimal("2000.00"),
            opening_balance_date=date(2026, 3, 1),
        )
        make_txn(first, amount="-100.00", booked_on=date(2026, 4, 10))

        result = household_series(household=household, end=date(2026, 4, 30))

        axis = [p.on for p in result.total]
        assert axis[0] == date(2026, 1, 1)
        for series in result.accounts:
            assert [p.on for p in series.points] == axis
        assert {s.account_id for s in result.accounts} == {str(first.id), str(second.id)}

    def test_before_it_opens_an_account_contributes_nothing(self, household):
        """Not its opening balance projected backwards — money it did not hold."""
        BankAccountFactory(
            household=household,
            opening_balance=Decimal("500.00"),
            opening_balance_date=date(2026, 1, 1),
        )
        BankAccountFactory(
            household=household,
            opening_balance=Decimal("2000.00"),
            opening_balance_date=date(2026, 3, 1),
        )

        result = household_series(household=household, end=date(2026, 3, 31))
        total = {p.on: p.amount for p in result.total}

        assert total[date(2026, 2, 1)] == Decimal("500.00")
        assert total[date(2026, 3, 1)] == Decimal("2500.00")

    def test_the_total_is_the_sum_of_the_curves_on_every_date(self, household):
        first = BankAccountFactory(
            household=household,
            opening_balance=Decimal("500.00"),
            opening_balance_date=date(2026, 1, 1),
        )
        second = BankAccountFactory(
            household=household,
            opening_balance=Decimal("2000.00"),
            opening_balance_date=date(2026, 1, 1),
        )
        make_txn(first, amount="-100.00", booked_on=date(2026, 2, 10))
        make_txn(second, amount="300.00", booked_on=date(2026, 2, 20))

        result = household_series(household=household, end=date(2026, 2, 28))

        for index, point in enumerate(result.total):
            assert point.amount == sum(s.points[index].amount for s in result.accounts)

    def test_an_archived_account_is_left_out(self, household):
        """Same arbitrage as the balance card: a closed account has nothing to watch."""
        live = BankAccountFactory(
            household=household, opening_balance_date=date(2026, 1, 1), name="Courant"
        )
        BankAccountFactory(
            household=household,
            opening_balance_date=date(2026, 1, 1),
            name="Vieux compte",
            archived=True,
        )

        result = household_series(household=household, end=date(2026, 2, 28))

        assert [s.account_id for s in result.accounts] == [str(live.id)]

    def test_cash_counts_as_money_the_household_holds(self, household):
        bank = BankAccountFactory(
            household=household,
            opening_balance=Decimal("500.00"),
            opening_balance_date=date(2026, 1, 1),
        )
        cash = BankAccountFactory(
            household=household,
            kind=BankAccount.Kind.CASH,
            bank_label="",
            opening_balance=Decimal("60.00"),
            opening_balance_date=date(2026, 1, 1),
        )

        result = household_series(household=household, end=date(2026, 1, 31))

        assert {s.account_id for s in result.accounts} == {str(bank.id), str(cash.id)}
        assert result.total[-1].amount == Decimal("560.00")

    def test_one_unreliable_account_makes_the_total_unreliable(self, household):
        account = BankAccountFactory(household=household, opening_balance_date=date(2026, 1, 1))
        BankAccountFactory(household=household, opening_balance_date=date(2026, 1, 1))
        make_txn(account, amount="-10.00", booked_on=date(2026, 1, 5), balance_after="990.00")
        make_txn(account, amount="-20.00", booked_on=date(2026, 1, 9), balance_after="500.00")

        result = household_series(household=household, end=date(2026, 1, 31))

        assert result.is_reliable is False

    def test_a_household_without_any_account_draws_nothing(self, household):
        result = household_series(household=household, end=date(2026, 1, 31))

        assert result.accounts == []
        assert result.total == []
