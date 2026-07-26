# interactions/tests/test_bank_link.py
"""The banking link seen from the interactions side.

Two things are protected here that the banking tests cannot reach:

- the **generic PATCH** on an expense, which is the write path that has never
  heard of a bank line and would otherwise break the invariant in silence;
- the fact that a bank-born expense has **no zone**, whereas the interaction
  create endpoint demands one — hence the mandatory detour through the service.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.models import BankAccount, BankTransaction, TransactionDirection
from banking.services import set_allocations
from budget.models import Budget
from households.models import Household, HouseholdMember
from interactions.kinds import KIND_BANK
from interactions.models import Interaction

from accounts.models import User

_counter = itertools.count()
LIST_URL = "/api/interactions/interactions/"


def make_household_user():
    household = Household.objects.create(name="Bank link house")
    user = User.objects.create_user(email=f"u-{next(_counter)}@example.com", password="pass1234")
    HouseholdMember.objects.create(
        household=household, user=user, role=HouseholdMember.Role.MEMBER
    )
    user.active_household = household
    user.save(update_fields=["active_household"])
    return household, user


def make_txn(account, *, amount="-120.00", booked_on=date(2026, 7, 12)):
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=booked_on,
        label_raw="CB LECLERC",
        label_norm="CB LECLERC",
        amount=value,
        direction=TransactionDirection.OUT if value < 0 else TransactionDirection.IN,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=booked_on,
            label_norm="CB LECLERC",
            amount=value,
            currency="EUR",
            discriminant=f"#{next(_counter)}",
        ),
    )


@pytest.fixture
def context(db):
    household, user = make_household_user()
    account = BankAccount.objects.create(household=household, name="Compte joint")
    budget = Budget.objects.create(household=household, name="Courses", monthly_amount=400)
    client = APIClient()
    client.force_authenticate(user=user)
    return household, user, account, budget, client


@pytest.mark.django_db
class TestGenericPatchRespectsTheInvariant:
    def test_growing_an_allocation_past_the_line_is_a_400(self, context):
        """The scenario that would otherwise break the invariant silently."""
        household, user, account, budget, client = context
        txn = make_txn(account)
        first, second = set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {"subject": "A", "amount": "80.00", "budget_id": budget.id},
                {"subject": "B", "amount": "40.00", "budget_id": budget.id},
            ],
        )

        response = client.patch(f"{LIST_URL}{first.id}/", {"amount": "100.00"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        first.refresh_from_db()
        assert first.amount == Decimal("80.00")

    def test_shrinking_an_allocation_is_allowed(self, context):
        household, user, account, budget, client = context
        txn = make_txn(account)
        first, _ = set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {"subject": "A", "amount": "80.00", "budget_id": budget.id},
                {"subject": "B", "amount": "40.00", "budget_id": budget.id},
            ],
        )

        response = client.patch(f"{LIST_URL}{first.id}/", {"amount": "60.00"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        first.refresh_from_db()
        assert first.amount == Decimal("60.00")

    def test_an_unreconciled_expense_is_not_constrained(self, context):
        household, user, _, budget, client = context
        expense = Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Dépense libre",
            type="expense",
            occurred_at="2026-07-12T12:00:00Z",
            amount=Decimal("10.00"),
        )

        response = client.patch(f"{LIST_URL}{expense.id}/", {"amount": "999.00"}, format="json")

        assert response.status_code == status.HTTP_200_OK

    def test_bank_transaction_cannot_be_set_through_the_generic_patch(self, context):
        """The link belongs to banking.services, not to a client PATCH."""
        household, user, account, _, client = context
        txn = make_txn(account)
        expense = Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Dépense libre",
            type="expense",
            occurred_at="2026-07-12T12:00:00Z",
            amount=Decimal("10.00"),
        )

        client.patch(
            f"{LIST_URL}{expense.id}/",
            {"bank_transaction": str(txn.id), "reconciled_by": "auto"},
            format="json",
        )

        expense.refresh_from_db()
        assert expense.bank_transaction_id is None
        assert expense.reconciled_by == ""


@pytest.mark.django_db
class TestBankExpensesHaveNoZone:
    def test_the_service_creates_them_without_a_zone(self, context):
        """The create endpoint demands a zone; a statement line has none to give."""
        household, user, account, budget, _ = context
        txn = make_txn(account)

        created = set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"subject": "Courses", "amount": "120.00", "budget_id": budget.id}],
        )

        assert created[0].zones.count() == 0
        assert created[0].kind == KIND_BANK

    def test_the_list_endpoint_serializes_them_fine(self, context):
        household, user, account, budget, client = context
        txn = make_txn(account)
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"subject": "Courses", "amount": "120.00", "budget_id": budget.id}],
        )

        response = client.get(f"{LIST_URL}?type=expense")

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        rows = body["results"] if isinstance(body, dict) else body
        assert len(rows) == 1
        assert rows[0]["zone_names"] == []
        assert rows[0]["amount"] == "120.00"

    def test_the_detail_endpoint_serializes_them_fine(self, context):
        household, user, account, budget, client = context
        txn = make_txn(account)
        created = set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"subject": "Courses", "amount": "120.00", "budget_id": budget.id}],
        )

        response = client.get(f"{LIST_URL}{created[0].id}/")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["bank_transaction"] == str(txn.id)
