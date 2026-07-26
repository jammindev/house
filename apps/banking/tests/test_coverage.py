# banking/tests/test_coverage.py
"""The conformity horizon — what makes « zéro écart » reachable.

These tests exist because the alternative was unusable: a control that flags
every expense predating the first statement shows hundreds of écarts nobody can
ever fix, and an unfixable list stops being read. The window is therefore not a
convenience, it is what makes the whole parcours 26 worth building.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest

from banking.coverage import (
    accounts_with_window,
    covered_period,
    household_covered_period,
)
from banking.dedup import compute_dedup_hash
from banking.models import (
    BankTransaction,
    ImportStatus,
    StatementImport,
    TransactionDirection,
)

from .factories import BankAccountFactory, HouseholdFactory

_counter = itertools.count()


def make_txn(account, *, booked_on, amount="-10.00", label="CB TEST"):
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=booked_on,
        label_raw=label,
        label_norm=label.upper(),
        amount=value,
        direction=TransactionDirection.OUT if value < 0 else TransactionDirection.IN,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=booked_on,
            label_norm=label.upper(),
            amount=value,
            currency="EUR",
            discriminant=f"#{next(_counter)}",
        ),
    )


def make_import(account, *, period_start, period_end, status=ImportStatus.COMPLETED):
    return StatementImport.objects.create(
        household=account.household,
        account=account,
        provider="generic_csv",
        filename="relevé.csv",
        status=status,
        period_start=period_start,
        period_end=period_end,
    )


@pytest.mark.django_db
class TestCoveredPeriod:
    def test_no_window_without_an_opening_balance_date(self):
        """The prerequisite. Nothing can be asserted, so nothing is asserted."""
        account = BankAccountFactory(opening_balance_date=None)
        make_txn(account, booked_on=date(2026, 3, 1))
        assert covered_period(account) is None

    def test_no_window_when_nothing_has_been_imported(self):
        account = BankAccountFactory(opening_balance_date=date(2026, 1, 1))
        assert covered_period(account) is None

    def test_window_ends_at_the_last_import_period_end(self):
        account = BankAccountFactory(opening_balance_date=date(2026, 1, 1))
        make_import(account, period_start=date(2026, 1, 1), period_end=date(2026, 3, 31))
        make_import(account, period_start=date(2026, 4, 1), period_end=date(2026, 6, 30))

        window = covered_period(account)
        assert window is not None
        assert window.start == date(2026, 1, 1)
        assert window.end == date(2026, 6, 30)

    def test_a_failed_import_does_not_extend_the_window(self):
        """A failed import wrote nothing — claiming its period would be a lie."""
        account = BankAccountFactory(opening_balance_date=date(2026, 1, 1))
        make_import(account, period_start=date(2026, 1, 1), period_end=date(2026, 3, 31))
        make_import(
            account,
            period_start=date(2026, 4, 1),
            period_end=date(2026, 6, 30),
            status=ImportStatus.FAILED,
        )

        assert covered_period(account).end == date(2026, 3, 31)

    def test_transactions_extend_the_window_without_an_import(self):
        """A cash account has no import — its lines are the only signal it has."""
        account = BankAccountFactory(opening_balance_date=date(2026, 1, 1))
        make_txn(account, booked_on=date(2026, 5, 20))
        assert covered_period(account).end == date(2026, 5, 20)

    def test_window_takes_the_latest_of_both_signals(self):
        account = BankAccountFactory(opening_balance_date=date(2026, 1, 1))
        make_import(account, period_start=date(2026, 1, 1), period_end=date(2026, 3, 31))
        make_txn(account, booked_on=date(2026, 4, 15))
        assert covered_period(account).end == date(2026, 4, 15)

    def test_no_window_when_everything_predates_the_opening_balance(self):
        """An empty window is not "tout va bien" — it is "on ne sait rien"."""
        account = BankAccountFactory(opening_balance_date=date(2026, 6, 1))
        make_txn(account, booked_on=date(2026, 1, 15))
        assert covered_period(account) is None

    def test_contains_is_inclusive_on_both_bounds(self):
        account = BankAccountFactory(opening_balance_date=date(2026, 1, 1))
        make_import(account, period_start=date(2026, 1, 1), period_end=date(2026, 3, 31))
        window = covered_period(account)

        assert window.contains(date(2026, 1, 1))
        assert window.contains(date(2026, 3, 31))
        assert not window.contains(date(2025, 12, 31))
        assert not window.contains(date(2026, 4, 1))


@pytest.mark.django_db
class TestAccountsWithWindow:
    def test_skips_accounts_without_a_window(self):
        household = HouseholdFactory()
        ready = BankAccountFactory(
            household=household, name="Courant", opening_balance_date=date(2026, 1, 1)
        )
        make_import(ready, period_start=date(2026, 1, 1), period_end=date(2026, 3, 31))
        BankAccountFactory(household=household, name="Sans solde", opening_balance_date=None)

        pairs = accounts_with_window(household)
        assert [account.name for account, _ in pairs] == ["Courant"]

    def test_skips_archived_accounts(self):
        household = HouseholdFactory()
        archived = BankAccountFactory(
            household=household, opening_balance_date=date(2026, 1, 1), archived=True
        )
        make_import(archived, period_start=date(2026, 1, 1), period_end=date(2026, 3, 31))
        assert accounts_with_window(household) == []


@pytest.mark.django_db
class TestHouseholdCoveredPeriod:
    def test_is_the_union_of_the_account_windows(self):
        """Widest reading on purpose: an expense is not tied to an account, so the
        only honest question is « was *some* account being tracked then? »."""
        household = HouseholdFactory()
        first = BankAccountFactory(
            household=household, name="CA", opening_balance_date=date(2026, 1, 1)
        )
        make_import(first, period_start=date(2026, 1, 1), period_end=date(2026, 3, 31))
        second = BankAccountFactory(
            household=household, name="LCL", opening_balance_date=date(2026, 2, 1)
        )
        make_import(second, period_start=date(2026, 2, 1), period_end=date(2026, 6, 30))

        window = household_covered_period(household)
        assert window.start == date(2026, 1, 1)
        assert window.end == date(2026, 6, 30)

    def test_none_when_no_account_has_a_window(self):
        assert household_covered_period(HouseholdFactory()) is None
