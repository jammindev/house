# banking/tests/test_aggregations.py
"""Bank flow aggregates.

Two things are being protected here:

1. The **sign convention** — ``amount`` is signed, so a naive ``Sum`` would net
   income against spending and understate both.
2. The **separation from the expense world** — bank totals and interaction
   totals are two views of the same money and must never be added.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest

from banking.aggregations import compute_account_flow
from banking.dedup import compute_dedup_hash
from banking.models import BankTransaction, TransactionDirection

from .factories import BankAccountFactory, HouseholdFactory

_counter = itertools.count()


def make_txn(account, *, amount, booked_on=date(2026, 7, 12), internal=False, label="X"):
    """Create a transaction the way the importer would.

    The dedup hash goes through the real recipe (a counter stands in for the
    discriminant) so the unique constraint behaves exactly as in production.
    """
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=booked_on,
        label_raw=label,
        label_norm=label.upper(),
        amount=value,
        direction=TransactionDirection.OUT if value < 0 else TransactionDirection.IN,
        is_internal=internal,
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
    household = HouseholdFactory()
    return BankAccountFactory(household=household)


@pytest.mark.django_db
class TestComputeAccountFlow:
    def test_splits_inflow_and_outflow_as_positive_numbers(self, account):
        make_txn(account, amount="-32.50")
        make_txn(account, amount="-10.00")
        make_txn(account, amount="2100.00")

        flow = compute_account_flow(household=account.household)

        assert flow["outflow"] == "42.50"
        assert flow["inflow"] == "2100.00"
        assert flow["net"] == "2057.50"
        assert flow["transaction_count"] == 3

    def test_internal_movements_are_excluded_from_both_totals(self, account):
        """An ATM withdrawal is not spending — the cash is counted when spent."""
        make_txn(account, amount="-32.50")
        make_txn(account, amount="-100.00", internal=True, label="RETRAIT DAB")

        flow = compute_account_flow(household=account.household)

        assert flow["outflow"] == "32.50"
        assert flow["inflow"] == "0.00"
        assert flow["transaction_count"] == 1
        assert flow["internal_count"] == 1

    def test_empty_household_returns_zeros_not_none(self, account):
        flow = compute_account_flow(household=account.household)
        assert flow["outflow"] == "0.00"
        assert flow["inflow"] == "0.00"
        assert flow["net"] == "0.00"

    def test_filters_by_account(self, account):
        other = BankAccountFactory(household=account.household, name="Second")
        make_txn(account, amount="-32.50")
        make_txn(other, amount="-99.00")

        assert compute_account_flow(household=account.household, account=account)["outflow"] == "32.50"
        assert compute_account_flow(household=account.household, account=other)["outflow"] == "99.00"
        assert compute_account_flow(household=account.household)["outflow"] == "131.50"

    def test_filters_by_period_inclusively(self, account):
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1))
        make_txn(account, amount="-20.00", booked_on=date(2026, 7, 15))
        make_txn(account, amount="-40.00", booked_on=date(2026, 8, 1))

        flow = compute_account_flow(
            household=account.household,
            date_from=date(2026, 7, 1),
            date_to=date(2026, 7, 31),
        )

        assert flow["outflow"] == "30.00"

    def test_does_not_leak_another_household(self, account):
        stranger = BankAccountFactory(household=HouseholdFactory())
        make_txn(stranger, amount="-999.00")
        make_txn(account, amount="-32.50")

        assert compute_account_flow(household=account.household)["outflow"] == "32.50"


@pytest.mark.django_db
class TestExpenseAggregatesAreUnaffected:
    """The lot-3 acceptance criterion, expressed as a test.

    Bank transactions live in a parallel world until lot 5 allocates them. No
    amount of imported statement may move a budget or expense figure — and once
    allocations exist, the totals still come from the interactions, never from
    the bank.
    """

    def test_budget_overview_ignores_bank_transactions(self, account):
        from budget.aggregations import compute_budget_overview

        before = compute_budget_overview(household=account.household)
        make_txn(account, amount="-500.00")
        after = compute_budget_overview(household=account.household)

        assert before["total_spent"] == after["total_spent"]
        assert after["total_spent"] == "0.00"

    def test_expense_summary_ignores_bank_transactions(self, account):
        from django.utils import timezone

        from interactions.aggregations import compute_expense_summary

        make_txn(account, amount="-500.00")
        now = timezone.now()
        summary = compute_expense_summary(
            household_id=account.household.id,
            from_dt=now - timezone.timedelta(days=365),
            to_dt=now + timezone.timedelta(days=1),
        )

        assert Decimal(summary["total"]) == Decimal("0.00")
        assert summary["count"] == 0
