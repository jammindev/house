# banking/tests/test_api_allocations.py
"""REST tests for the allocation endpoints."""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.models import BankTransaction, TransactionDirection
from budget.models import Budget
from households.models import HouseholdMember
from interactions.models import Interaction

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

TX_URL = "/api/banking/transactions/"
_counter = itertools.count()


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
    household = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    client = APIClient()
    client.force_authenticate(user=user)
    account = BankAccountFactory(household=household)
    groceries = Budget.objects.create(household=household, name="Courses", monthly_amount=400)
    diy = Budget.objects.create(household=household, name="Bricolage", monthly_amount=200)
    return household, user, account, groceries, diy, client


@pytest.mark.django_db
class TestAllocationsEndpoint:
    def test_put_replaces_the_split_and_returns_the_remainder(self, context):
        _, _, account, groceries, diy, client = context
        txn = make_txn(account)

        response = client.put(
            f"{TX_URL}{txn.id}/allocations/",
            {
                "lines": [
                    {"subject": "Courses", "amount": "80.00", "budget_id": str(groceries.id)},
                    {"subject": "Vis", "amount": "40.00", "budget_id": str(diy.id)},
                ]
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert len(body["allocations"]) == 2
        assert body["allocated"] == "120.00"
        assert body["remaining"] == "0.00"

    def test_get_reads_the_current_split(self, context):
        _, _, account, groceries, _, client = context
        txn = make_txn(account)
        client.put(
            f"{TX_URL}{txn.id}/allocations/",
            {"lines": [{"subject": "A", "amount": "50.00", "budget_id": str(groceries.id)}]},
            format="json",
        )

        body = client.get(f"{TX_URL}{txn.id}/allocations/").json()

        assert len(body["allocations"]) == 1
        assert body["remaining"] == "70.00"

    def test_over_allocation_is_a_400_and_writes_nothing(self, context):
        _, _, account, groceries, diy, client = context
        txn = make_txn(account)

        response = client.put(
            f"{TX_URL}{txn.id}/allocations/",
            {
                "lines": [
                    {"subject": "A", "amount": "80.00", "budget_id": str(groceries.id)},
                    {"subject": "B", "amount": "50.00", "budget_id": str(diy.id)},
                ]
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert txn.interactions.count() == 0

    def test_lines_must_be_a_list(self, context):
        _, _, account, _, _, client = context
        txn = make_txn(account)
        response = client.put(
            f"{TX_URL}{txn.id}/allocations/", {"lines": "nope"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_another_households_operation_is_not_reachable(self, context):
        _, _, _, _, _, client = context
        stranger = BankAccountFactory(household=HouseholdFactory())
        txn = make_txn(stranger)

        response = client.put(
            f"{TX_URL}{txn.id}/allocations/", {"lines": []}, format="json"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestLinkUnlinkEndpoints:
    def _expense(self, household, user, amount="120.00"):
        return Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Achat granulés",
            type="expense",
            occurred_at="2026-07-12T12:00:00Z",
            amount=Decimal(amount),
            kind="stock_purchase",
        )

    def test_link_attaches_an_expense(self, context):
        household, user, account, _, _, client = context
        txn = make_txn(account)
        expense = self._expense(household, user)

        response = client.post(
            f"{TX_URL}{txn.id}/link/", {"interaction": str(expense.id)}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        expense.refresh_from_db()
        assert expense.bank_transaction_id == txn.id

    def test_link_requires_the_interaction_field(self, context):
        _, _, account, _, _, client = context
        txn = make_txn(account)
        response = client.post(f"{TX_URL}{txn.id}/link/", {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_link_refuses_an_expense_of_another_household(self, context):
        _, user, account, _, _, client = context
        txn = make_txn(account)
        stranger_expense = self._expense(HouseholdFactory(), user)

        response = client.post(
            f"{TX_URL}{txn.id}/link/", {"interaction": str(stranger_expense.id)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unlink_detaches_without_deleting(self, context):
        household, user, account, _, _, client = context
        txn = make_txn(account)
        expense = self._expense(household, user)
        client.post(f"{TX_URL}{txn.id}/link/", {"interaction": str(expense.id)}, format="json")

        response = client.delete(f"{TX_URL}{txn.id}/unlink/{expense.id}/")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        expense.refresh_from_db()
        assert expense.bank_transaction_id is None
        assert Interaction.objects.filter(pk=expense.pk).exists()

    def test_unlink_of_an_unrelated_expense_is_a_400(self, context):
        household, user, account, _, _, client = context
        txn = make_txn(account)
        expense = self._expense(household, user)

        response = client.delete(f"{TX_URL}{txn.id}/unlink/{expense.id}/")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
