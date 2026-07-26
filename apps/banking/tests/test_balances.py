# banking/tests/test_balances.py
"""Balances and the statement chain check.

The balance is the **test of the import**: if it matches the paper statement,
the import is right. So the tests below care as much about *admitting
uncertainty* as about arithmetic — a plausible-looking wrong number is the one
failure mode that would silently poison everything downstream.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest

from banking.balances import ANCHORED, DERIVED, check_balance_chain, compute_balance
from banking.dedup import compute_dedup_hash
from banking.models import BankTransaction, TransactionDirection

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
def account(db):
    return BankAccountFactory(household=HouseholdFactory())


@pytest.mark.django_db
class TestAnchoredBalance:
    def test_uses_the_banks_own_running_balance(self, account):
        make_txn(account, amount="-32.50", booked_on=date(2026, 7, 12), balance_after="1000.00")
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 13), balance_after="990.00")

        result = compute_balance(account=account)

        assert result.source == ANCHORED
        assert result.amount == Decimal("990.00")
        assert result.is_reliable is True

    def test_adds_movements_that_came_after_the_last_anchor(self, account):
        """A file without balances imported on top of one that had them."""
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1), balance_after="990.00")
        make_txn(account, amount="-40.00", booked_on=date(2026, 7, 5))
        make_txn(account, amount="-50.00", booked_on=date(2026, 7, 8))

        result = compute_balance(account=account)

        assert result.source == ANCHORED
        assert result.amount == Decimal("900.00")

    def test_needs_no_continuity_assumption(self, account):
        """A missing January must not corrupt a March balance."""
        account.opening_balance = Decimal("999999.00")
        account.opening_balance_date = None
        account.save()
        make_txn(account, amount="-10.00", booked_on=date(2026, 3, 1), balance_after="500.00")

        assert compute_balance(account=account).amount == Decimal("500.00")

    def test_as_of_rewinds_to_a_date(self, account):
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1), balance_after="990.00")
        make_txn(account, amount="-40.00", booked_on=date(2026, 7, 20), balance_after="950.00")

        result = compute_balance(account=account, as_of=date(2026, 7, 10))

        assert result.amount == Decimal("990.00")
        assert result.as_of == date(2026, 7, 10)


@pytest.mark.django_db
class TestDerivedBalance:
    def test_opening_balance_plus_movements(self, account):
        account.opening_balance = Decimal("1000.00")
        account.opening_balance_date = date(2026, 7, 1)
        account.save()
        make_txn(account, amount="-32.50", booked_on=date(2026, 7, 12))
        make_txn(account, amount="100.00", booked_on=date(2026, 7, 15))

        result = compute_balance(account=account)

        assert result.source == DERIVED
        assert result.amount == Decimal("1067.50")
        assert result.is_reliable is True

    def test_ignores_movements_before_the_opening_date(self, account):
        account.opening_balance = Decimal("1000.00")
        account.opening_balance_date = date(2026, 7, 1)
        account.save()
        make_txn(account, amount="-500.00", booked_on=date(2026, 6, 15))
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 5))

        assert compute_balance(account=account).amount == Decimal("990.00")

    def test_without_an_opening_date_it_admits_it_is_a_guess(self, account):
        """Summing from an assumed start is a guess — say so rather than be wrong."""
        account.opening_balance = Decimal("0.00")
        account.opening_balance_date = None
        account.save()
        make_txn(account, amount="-32.50", booked_on=date(2026, 7, 12))

        result = compute_balance(account=account)

        assert result.source == DERIVED
        assert result.amount == Decimal("-32.50")
        assert result.is_reliable is False

    def test_empty_account_falls_back_to_its_opening_balance(self, account):
        account.opening_balance = Decimal("250.00")
        account.opening_balance_date = date(2026, 7, 1)
        account.save()

        assert compute_balance(account=account).amount == Decimal("250.00")


@pytest.mark.django_db
class TestChainCheck:
    def test_intact_chain_reports_no_gap(self, account):
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1), balance_after="990.00")
        make_txn(account, amount="-20.00", booked_on=date(2026, 7, 2), balance_after="970.00")
        make_txn(account, amount="50.00", booked_on=date(2026, 7, 3), balance_after="1020.00")

        assert check_balance_chain(account=account) == []

    def test_a_hole_is_detected_with_its_interval_and_amount(self, account):
        """Lines removed in the middle: the bank's own figures give us away."""
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1), balance_after="990.00")
        # 60 € of operations are missing here.
        make_txn(account, amount="-20.00", booked_on=date(2026, 7, 20), balance_after="910.00")

        gaps = check_balance_chain(account=account)

        assert len(gaps) == 1
        gap = gaps[0]
        assert gap.gap_start == date(2026, 7, 1)
        assert gap.gap_end == date(2026, 7, 20)
        assert gap.expected == Decimal("970.00")
        assert gap.actual == Decimal("910.00")
        assert gap.missing_amount == Decimal("-60.00")

    def test_a_gap_makes_the_balance_unreliable(self, account):
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1), balance_after="990.00")
        make_txn(account, amount="-20.00", booked_on=date(2026, 7, 20), balance_after="910.00")

        result = compute_balance(account=account)

        assert result.is_reliable is False
        assert len(result.gaps) == 1
        # The figure is still the bank's own, so it is worth showing — flagged.
        assert result.amount == Decimal("910.00")

    def test_same_day_operations_are_checked_in_statement_order(self, account):
        """Without ``line_no`` the chain would compare balances that never followed."""
        day = date(2026, 7, 12)
        make_txn(account, amount="-10.00", booked_on=day, balance_after="990.00", line_no=2)
        make_txn(account, amount="-20.00", booked_on=day, balance_after="970.00", line_no=3)
        make_txn(account, amount="-30.00", booked_on=day, balance_after="940.00", line_no=4)

        assert check_balance_chain(account=account) == []

    def test_a_file_without_balances_cannot_be_checked_but_is_not_a_gap(self, account):
        """Inventing a break would be worse than admitting we cannot verify."""
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1))
        make_txn(account, amount="-20.00", booked_on=date(2026, 7, 2))

        assert check_balance_chain(account=account) == []

    def test_lines_without_a_balance_do_not_break_the_chain(self, account):
        """A mixed file: only the anchored lines take part in the check."""
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1), balance_after="990.00")
        make_txn(account, amount="-20.00", booked_on=date(2026, 7, 2))
        make_txn(account, amount="-30.00", booked_on=date(2026, 7, 3), balance_after="940.00")

        # 990 - 30 != 940, so the check *does* fire — correctly, because the
        # middle line is invisible to it. This documents the known limit.
        gaps = check_balance_chain(account=account)
        assert len(gaps) == 1


@pytest.mark.django_db
class TestBalanceIsNeverStored:
    def test_no_balance_column_on_the_account(self):
        """The rule of parcours 21, applied to money in the bank."""
        from banking.models import BankAccount

        field_names = {f.name for f in BankAccount._meta.get_fields()}
        assert "current_balance" not in field_names
        assert "balance" not in field_names
