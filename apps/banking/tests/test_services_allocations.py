# banking/tests/test_services_allocations.py
"""Ventilation — the heart of the parcours.

There is **no Allocation table**: a line split 80/40 simply carries two
``Interaction(type='expense')``. These tests protect the two consequences that
make the choice worth it:

- the project's expense aggregations keep working untouched;
- editing or deleting a split never destroys a fact the household journalled
  outside of it.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from banking.dedup import compute_dedup_hash
from banking.models import BankTransaction, TransactionDirection
from banking.services import (
    delete_transaction,
    link_interaction,
    set_allocations,
    unlink_interaction,
)
from banking.validators import remaining_to_allocate
from budget.models import Budget
from interactions.kinds import KIND_BANK, KIND_STOCK_PURCHASE
from interactions.models import Interaction

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount="-120.00", booked_on=date(2026, 7, 12), label="CB LECLERC", **extra):
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
    user = UserFactory()
    account = BankAccountFactory(household=household)
    groceries = Budget.objects.create(household=household, name="Courses", monthly_amount=400)
    diy = Budget.objects.create(household=household, name="Bricolage", monthly_amount=200)
    return household, user, account, groceries, diy


@pytest.mark.django_db
class TestSetAllocations:
    def test_splits_one_line_into_two_expenses(self, context):
        household, user, account, groceries, diy = context
        txn = make_txn(account)

        created = set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {"subject": "Courses", "amount": "80.00", "budget_id": groceries.id},
                {"subject": "Vis et chevilles", "amount": "40.00", "budget_id": diy.id},
            ],
        )

        assert len(created) == 2
        assert {i.amount for i in created} == {Decimal("80.00"), Decimal("40.00")}
        assert {i.budget_id for i in created} == {groceries.id, diy.id}
        assert all(i.kind == KIND_BANK for i in created)
        assert all(i.bank_transaction_id == txn.id for i in created)
        assert all(i.type == "expense" for i in created)

    def test_occurred_at_is_noon_so_the_month_never_slips(self, context):
        """Midnight on the 1st or the 31st would land in the wrong budget month."""
        household, user, account, groceries, _ = context
        txn = make_txn(account, amount="-50.00", booked_on=date(2026, 8, 1))

        created = set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"subject": "X", "amount": "50.00", "budget_id": groceries.id}],
        )

        occurred = created[0].occurred_at
        assert occurred.date() == date(2026, 8, 1)
        assert occurred.hour == 12

    def test_replacing_a_split_is_atomic(self, context):
        household, user, account, groceries, diy = context
        txn = make_txn(account)
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {"subject": "A", "amount": "80.00", "budget_id": groceries.id},
                {"subject": "B", "amount": "40.00", "budget_id": diy.id},
            ],
        )

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {"subject": "A", "amount": "100.00", "budget_id": groceries.id},
                {"subject": "B", "amount": "20.00", "budget_id": diy.id},
            ],
        )

        amounts = sorted(i.amount for i in txn.interactions.all())
        assert amounts == [Decimal("20.00"), Decimal("100.00")]

    def test_over_allocation_is_refused_and_writes_nothing(self, context):
        household, user, account, groceries, diy = context
        txn = make_txn(account)

        with pytest.raises(ValidationError):
            set_allocations(
                household=household,
                user=user,
                transaction=txn,
                lines=[
                    {"subject": "A", "amount": "80.00", "budget_id": groceries.id},
                    {"subject": "B", "amount": "50.00", "budget_id": diy.id},
                ],
            )

        assert txn.interactions.count() == 0

    def test_a_zero_or_negative_line_is_refused(self, context):
        household, user, account, groceries, _ = context
        txn = make_txn(account)
        with pytest.raises(ValidationError):
            set_allocations(
                household=household,
                user=user,
                transaction=txn,
                lines=[{"subject": "A", "amount": "0", "budget_id": groceries.id}],
            )

    def test_an_internal_movement_cannot_be_allocated(self, context):
        """Its money is counted once, later, when the cash it fed is spent."""
        household, user, account, groceries, _ = context
        cash = BankAccountFactory(household=household, name="Espèces", kind="cash", bank_label="")
        withdrawal = make_txn(account, amount="-100.00", label="RETRAIT DAB")
        from banking.services import record_cash_withdrawal

        record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=cash)
        withdrawal.refresh_from_db()

        with pytest.raises(ValidationError):
            set_allocations(
                household=household,
                user=user,
                transaction=withdrawal,
                lines=[{"subject": "X", "amount": "50.00", "budget_id": groceries.id}],
            )

    def test_an_incoming_operation_cannot_be_allocated(self, context):
        household, user, account, groceries, _ = context
        income = make_txn(account, amount="2100.00", label="VIR SALAIRE")
        with pytest.raises(ValidationError):
            set_allocations(
                household=household,
                user=user,
                transaction=income,
                lines=[{"subject": "X", "amount": "50.00", "budget_id": groceries.id}],
            )

    def test_partial_allocation_leaves_a_remainder(self, context):
        household, user, account, groceries, _ = context
        txn = make_txn(account)
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"subject": "A", "amount": "80.00", "budget_id": groceries.id}],
        )

        assert remaining_to_allocate(txn) == Decimal("40.00")


@pytest.mark.django_db
class TestTheEditorOnlyDeletesWhatItCreated:
    def _reconciled_stock_purchase(self, household, user, txn):
        """An expense that pre-existed the statement and got reconciled onto it."""
        purchase = Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Achat granulés",
            type="expense",
            occurred_at=txn.booked_on,
            amount=Decimal("120.00"),
            kind=KIND_STOCK_PURCHASE,
        )
        link_interaction(user=user, transaction=txn, interaction=purchase)
        return purchase

    def test_a_reconciled_purchase_is_detached_not_destroyed(self, context):
        household, user, account, groceries, _ = context
        txn = make_txn(account)
        purchase = self._reconciled_stock_purchase(household, user, txn)

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"subject": "A", "amount": "120.00", "budget_id": groceries.id}],
        )

        purchase.refresh_from_db()
        assert Interaction.objects.filter(pk=purchase.pk).exists()
        assert purchase.bank_transaction_id is None
        assert purchase.reconciled_by == ""

    def test_deleting_the_line_keeps_the_purchase_and_drops_the_bank_rows(self, context):
        household, user, account, groceries, _ = context
        txn = make_txn(account, amount="-240.00")
        purchase = self._reconciled_stock_purchase(household, user, txn)
        generated = set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"subject": "A", "amount": "100.00", "budget_id": groceries.id}],
        )
        # `set_allocations` detached the purchase; re-link it to test both paths.
        purchase.refresh_from_db()
        link_interaction(user=user, transaction=txn, interaction=purchase)

        delete_transaction(user=user, transaction=txn)

        purchase.refresh_from_db()
        assert Interaction.objects.filter(pk=purchase.pk).exists()
        assert purchase.bank_transaction_id is None
        assert not Interaction.objects.filter(pk=generated[0].pk).exists()


@pytest.mark.django_db
class TestLinkAndUnlink:
    def test_link_attaches_an_existing_expense(self, context):
        household, user, account, _, _ = context
        txn = make_txn(account)
        expense = Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Achat",
            type="expense",
            occurred_at=txn.booked_on,
            amount=Decimal("120.00"),
            kind=KIND_STOCK_PURCHASE,
        )

        link_interaction(user=user, transaction=txn, interaction=expense)

        expense.refresh_from_db()
        assert expense.bank_transaction_id == txn.id
        assert expense.reconciled_by == "manual"

    def test_link_refuses_another_household(self, context):
        _, user, account, _, _ = context
        txn = make_txn(account)
        stranger = Interaction.objects.create(
            household=HouseholdFactory(),
            subject="Autre",
            type="expense",
            occurred_at=txn.booked_on,
            amount=Decimal("10.00"),
        )
        with pytest.raises(ValidationError):
            link_interaction(user=user, transaction=txn, interaction=stranger)

    def test_link_refuses_a_non_expense(self, context):
        household, user, account, _, _ = context
        txn = make_txn(account)
        note = Interaction.objects.create(
            household=household, subject="Note", type="note", occurred_at=txn.booked_on
        )
        with pytest.raises(ValidationError):
            link_interaction(user=user, transaction=txn, interaction=note)

    def test_link_refuses_to_overshoot(self, context):
        household, user, account, groceries, _ = context
        txn = make_txn(account)
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"subject": "A", "amount": "100.00", "budget_id": groceries.id}],
        )
        expense = Interaction.objects.create(
            household=household,
            subject="Trop gros",
            type="expense",
            occurred_at=txn.booked_on,
            amount=Decimal("50.00"),
        )
        with pytest.raises(ValidationError):
            link_interaction(user=user, transaction=txn, interaction=expense)

    def test_unlink_keeps_the_expense(self, context):
        household, user, account, _, _ = context
        txn = make_txn(account)
        expense = Interaction.objects.create(
            household=household,
            subject="Achat",
            type="expense",
            occurred_at=txn.booked_on,
            amount=Decimal("120.00"),
            kind=KIND_STOCK_PURCHASE,
        )
        link_interaction(user=user, transaction=txn, interaction=expense)

        unlink_interaction(user=user, interaction=expense)

        expense.refresh_from_db()
        assert expense.bank_transaction_id is None
        assert Interaction.objects.filter(pk=expense.pk).exists()
