# banking/tests/test_api_credit_budget.py
"""REST : créditer une enveloppe depuis la dépense remboursée.

L'arithmétique et les invariants vivent dans ``test_credit_budget.py``. Ce qui se
vérifie ici, c'est le contrat que le front consomme — et une fois de plus, à
travers HTTP, que ce chemin **n'efface pas** la répartition des autres.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.models import BankTransaction, InflowNature, TransactionDirection
from budget.models import Budget
from households.models import HouseholdMember

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

TX_URL = "/api/banking/transactions/"

_counter = itertools.count()


def make_inflow(account, *, amount="70.00", nature=InflowNature.REFUND):
    value = Decimal(amount)
    label = "REMBOURSEMENT AMAZON"
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=date(2026, 7, 28),
        label_raw=label,
        label_norm=label,
        amount=value,
        direction=TransactionDirection.IN,
        inflow_nature=nature,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=date(2026, 7, 28),
            label_norm=label,
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
    budgets = {
        name: Budget.objects.create(
            household=household, name=name, monthly_amount=Decimal("400.00")
        )
        for name in ("Courses", "Santé")
    }
    return household, user, account, budgets, client


@pytest.mark.django_db
class TestCreditingFromTheExpenseSide:
    def test_it_credits_and_returns_the_line(self, context):
        _, _, account, budgets, client = context
        refund = make_inflow(account)

        response = client.post(
            f"{TX_URL}{refund.id}/credit-budget/",
            {"budget": str(budgets["Courses"].id), "amount": "19.75"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["refund_allocations"] == [
            {
                "budget": str(budgets["Courses"].id),
                "budget_name": "Courses",
                "amount": "19.75",
            }
        ]
        assert body["refund_remaining"] == "50.25"

    def test_it_does_not_wipe_what_another_expense_already_credited(self, context):
        """⚠️ La régression, vue depuis HTTP."""
        _, _, account, budgets, client = context
        refund = make_inflow(account)
        client.post(
            f"{TX_URL}{refund.id}/credit-budget/",
            {"budget": str(budgets["Santé"].id), "amount": "30.00"},
            format="json",
        )

        client.post(
            f"{TX_URL}{refund.id}/credit-budget/",
            {"budget": str(budgets["Courses"].id), "amount": "19.75"},
            format="json",
        )

        body = client.get(f"{TX_URL}{refund.id}/").json()
        credited = {row["budget_name"]: row["amount"] for row in body["refund_allocations"]}
        assert credited == {"Santé": "30.00", "Courses": "19.75"}

    def test_an_unclassified_receipt_becomes_a_refund(self, context):
        _, _, account, budgets, client = context
        receipt = make_inflow(account, nature="")

        response = client.post(
            f"{TX_URL}{receipt.id}/credit-budget/",
            {"budget": str(budgets["Courses"].id), "amount": "19.75"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["inflow_nature"] == "refund"

    def test_a_salary_is_refused(self, context):
        _, _, account, budgets, client = context
        salary = make_inflow(account, nature=InflowNature.SALARY)

        response = client.post(
            f"{TX_URL}{salary.id}/credit-budget/",
            {"budget": str(budgets["Courses"].id), "amount": "19.75"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        salary.refresh_from_db()
        assert salary.inflow_nature == InflowNature.SALARY

    def test_more_than_the_receipt_is_refused(self, context):
        _, _, account, budgets, client = context
        refund = make_inflow(account)

        response = client.post(
            f"{TX_URL}{refund.id}/credit-budget/",
            {"budget": str(budgets["Courses"].id), "amount": "70.01"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_zero_removes_the_credit(self, context):
        _, _, account, budgets, client = context
        refund = make_inflow(account)
        client.post(
            f"{TX_URL}{refund.id}/credit-budget/",
            {"budget": str(budgets["Courses"].id), "amount": "19.75"},
            format="json",
        )

        response = client.post(
            f"{TX_URL}{refund.id}/credit-budget/",
            {"budget": str(budgets["Courses"].id), "amount": "0"},
            format="json",
        )

        assert response.json()["refund_allocations"] == []

    def test_another_households_line_is_not_reachable(self, context):
        _, _, _, budgets, client = context
        outsider = make_inflow(BankAccountFactory(household=HouseholdFactory()))

        response = client.post(
            f"{TX_URL}{outsider.id}/credit-budget/",
            {"budget": str(budgets["Courses"].id), "amount": "19.75"},
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
