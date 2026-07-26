# banking/tests/test_cash_counterpart.py
"""Cash counterpart of a withdrawal.

Without it, tracking a cash balance is pointless: the money leaves the bank
account but never *arrives* in the cash one, so the cash balance goes negative on
the first coffee paid in coins. And both legs must stay out of the spending
totals, or the household counts the same euros twice.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from banking.aggregations import compute_account_flow
from banking.balances import compute_balance
from banking.dedup import compute_dedup_hash
from banking.models import BankAccount, BankTransaction, TransactionDirection
from banking.services import record_cash_withdrawal, unlink_counterpart

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount, booked_on=date(2026, 7, 12), label="RETRAIT DAB", **extra):
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
        **extra,
    )


@pytest.fixture
def context(db):
    household = HouseholdFactory()
    bank = BankAccountFactory(household=household, name="Compte joint")
    cash = BankAccountFactory(
        household=household, name="Espèces", kind=BankAccount.Kind.CASH, bank_label=""
    )
    return household, UserFactory(), bank, cash


@pytest.mark.django_db
class TestRecordCashWithdrawal:
    def test_creates_a_linked_internal_credit(self, context):
        _, user, bank, cash = context
        withdrawal = make_txn(bank, amount="-100.00")

        mirror = record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=cash)

        withdrawal.refresh_from_db()
        assert mirror.account_id == cash.id
        assert mirror.amount == Decimal("100.00")
        assert mirror.direction == TransactionDirection.IN
        # Both legs internal: the money is counted once, when the cash is spent.
        assert mirror.is_internal is True
        assert withdrawal.is_internal is True
        # And they point at each other, so either side finds the other.
        assert withdrawal.transfer_counterpart_id == mirror.id
        assert mirror.transfer_counterpart_id == withdrawal.id

    def test_partial_amount_is_allowed(self, context):
        """Not every withdrawal ends up in the household's common pot."""
        _, user, bank, cash = context
        withdrawal = make_txn(bank, amount="-100.00")

        mirror = record_cash_withdrawal(
            user=user, transaction=withdrawal, cash_account=cash, amount="40.00"
        )

        assert mirror.amount == Decimal("40.00")

    def test_rejects_an_incoming_operation(self, context):
        _, user, bank, cash = context
        income = make_txn(bank, amount="2100.00", label="VIR SALAIRE")
        with pytest.raises(ValidationError):
            record_cash_withdrawal(user=user, transaction=income, cash_account=cash)

    def test_rejects_a_non_cash_target(self, context):
        household, user, bank, _ = context
        other_bank = BankAccountFactory(household=household, name="Livret")
        withdrawal = make_txn(bank, amount="-100.00")
        with pytest.raises(ValidationError):
            record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=other_bank)

    def test_rejects_another_households_cash_account(self, context):
        _, user, bank, _ = context
        stranger_cash = BankAccountFactory(
            household=HouseholdFactory(), kind=BankAccount.Kind.CASH
        )
        withdrawal = make_txn(bank, amount="-100.00")
        with pytest.raises(ValidationError):
            record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=stranger_cash)

    def test_rejects_more_than_the_withdrawal(self, context):
        _, user, bank, cash = context
        withdrawal = make_txn(bank, amount="-100.00")
        with pytest.raises(ValidationError):
            record_cash_withdrawal(
                user=user, transaction=withdrawal, cash_account=cash, amount="150.00"
            )

    def test_refuses_a_second_counterpart(self, context):
        _, user, bank, cash = context
        withdrawal = make_txn(bank, amount="-100.00")
        record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=cash)
        withdrawal.refresh_from_db()

        with pytest.raises(ValidationError):
            record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=cash)


@pytest.mark.django_db
class TestCounterpartsStayOutOfSpending:
    def test_neither_leg_appears_in_the_flow(self, context):
        household, user, bank, cash = context
        make_txn(bank, amount="-32.50", label="CB LECLERC")
        withdrawal = make_txn(bank, amount="-100.00")
        record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=cash)

        flow = compute_account_flow(household=household)

        assert flow["outflow"] == "32.50"
        assert flow["inflow"] == "0.00"
        assert flow["internal_count"] == 2

    def test_cash_balance_is_the_withdrawal_minus_what_was_spent(self, context):
        """The end-to-end point of the whole mechanism."""
        _, user, bank, cash = context
        cash.opening_balance = Decimal("0.00")
        cash.opening_balance_date = date(2026, 7, 1)
        cash.save()

        withdrawal = make_txn(bank, amount="-100.00", booked_on=date(2026, 7, 2))
        record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=cash)
        make_txn(cash, amount="-12.50", booked_on=date(2026, 7, 3), label="BOULANGERIE")

        assert compute_balance(account=cash).amount == Decimal("87.50")


@pytest.mark.django_db
class TestUnlinkCounterpart:
    def test_removes_the_generated_leg_and_unflags_the_source(self, context):
        _, user, bank, cash = context
        withdrawal = make_txn(bank, amount="-100.00")
        mirror = record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=cash)
        withdrawal.refresh_from_db()

        unlink_counterpart(user=user, transaction=withdrawal)

        withdrawal.refresh_from_db()
        assert withdrawal.transfer_counterpart_id is None
        assert withdrawal.is_internal is False
        assert not BankTransaction.objects.filter(pk=mirror.pk).exists()

    def test_is_a_no_op_without_a_counterpart(self, context):
        _, user, bank, _ = context
        withdrawal = make_txn(bank, amount="-100.00")
        unlink_counterpart(user=user, transaction=withdrawal)  # must not raise

    def test_an_imported_leg_is_detached_not_destroyed(self, context):
        """Only what we generated may be deleted — an imported line never is."""
        household, user, bank, cash = context
        from banking.models import ImportStatus, StatementImport

        trace = StatementImport.objects.create(
            household=household, account=cash, status=ImportStatus.COMPLETED
        )
        imported_leg = make_txn(cash, amount="100.00", label="DEPOT", source_import=trace)
        withdrawal = make_txn(bank, amount="-100.00")
        withdrawal.transfer_counterpart = imported_leg
        withdrawal.is_internal = True
        withdrawal.save()
        imported_leg.transfer_counterpart = withdrawal
        imported_leg.is_internal = True
        imported_leg.save()

        unlink_counterpart(user=user, transaction=withdrawal)

        imported_leg.refresh_from_db()
        assert BankTransaction.objects.filter(pk=imported_leg.pk).exists()
        assert imported_leg.transfer_counterpart_id is None
        assert imported_leg.is_internal is False

    def test_deleting_one_leg_leaves_no_dangling_pointer(self, context):
        """SET_NULL on the self-FK is what guarantees this."""
        _, user, bank, cash = context
        withdrawal = make_txn(bank, amount="-100.00")
        mirror = record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=cash)

        mirror.delete()

        withdrawal.refresh_from_db()
        assert withdrawal.transfer_counterpart_id is None
