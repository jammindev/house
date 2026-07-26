# banking/tests/test_api_transactions.py
"""
REST API tests for BankTransactionViewSet (/api/banking/transactions/).

Two contracts under test: the six filters behave, and a statement line is
**immutable in substance** — only its qualification (internal flag, note) can be
written.
"""
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

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

LIST_URL = "/api/banking/transactions/"
FLOW_URL = "/api/banking/transactions/flow/"

_counter = itertools.count()


def make_txn(account, *, amount, booked_on=date(2026, 7, 12), internal=False, label="CB LECLERC"):
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


def _make_member(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _rows(response) -> list:
    body = response.json()
    return body["results"] if isinstance(body, dict) else body


@pytest.fixture
def context(db):
    household = HouseholdFactory()
    user = _make_member(household)
    account = BankAccountFactory(household=household)
    return household, user, account, _client_for(user)


@pytest.mark.django_db
class TestTransactionList:
    def test_lists_own_household_newest_first(self, context):
        _, _, account, client = context
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1))
        make_txn(account, amount="-20.00", booked_on=date(2026, 7, 20))

        response = client.get(LIST_URL)

        assert response.status_code == status.HTTP_200_OK
        rows = _rows(response)
        assert [r["booked_on"] for r in rows] == ["2026-07-20", "2026-07-01"]

    def test_is_paginated(self, context):
        """Hundreds of lines a month — the list must not return them all."""
        _, _, account, client = context
        for i in range(3):
            make_txn(account, amount=f"-{i + 1}.00")

        response = client.get(f"{LIST_URL}?limit=2")

        body = response.json()
        assert body["count"] == 3
        assert len(body["results"]) == 2

    def test_does_not_leak_another_household(self, context):
        _, _, account, client = context
        make_txn(account, amount="-10.00")
        stranger_account = BankAccountFactory(household=HouseholdFactory())
        make_txn(stranger_account, amount="-999.00")

        assert len(_rows(client.get(LIST_URL))) == 1

    def test_anonymous_is_rejected(self, context):
        assert APIClient().get(LIST_URL).status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestTransactionFilters:
    def test_by_account(self, context):
        household, _, account, client = context
        other = BankAccountFactory(household=household, name="Second")
        make_txn(account, amount="-10.00")
        make_txn(other, amount="-20.00")

        assert len(_rows(client.get(f"{LIST_URL}?account={account.id}"))) == 1

    def test_by_date_range_inclusive(self, context):
        _, _, account, client = context
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1))
        make_txn(account, amount="-20.00", booked_on=date(2026, 7, 31))
        make_txn(account, amount="-30.00", booked_on=date(2026, 8, 1))

        rows = _rows(client.get(f"{LIST_URL}?date_from=2026-07-01&date_to=2026-07-31"))
        assert len(rows) == 2

    def test_by_direction(self, context):
        _, _, account, client = context
        make_txn(account, amount="-10.00")
        make_txn(account, amount="2100.00", label="VIR SALAIRE")

        assert len(_rows(client.get(f"{LIST_URL}?direction=out"))) == 1
        assert len(_rows(client.get(f"{LIST_URL}?direction=in"))) == 1

    def test_by_is_internal(self, context):
        _, _, account, client = context
        make_txn(account, amount="-10.00")
        make_txn(account, amount="-100.00", internal=True, label="RETRAIT DAB")

        assert len(_rows(client.get(f"{LIST_URL}?is_internal=true"))) == 1
        assert len(_rows(client.get(f"{LIST_URL}?is_internal=false"))) == 1

    def test_search_is_case_and_accent_insensitive(self, context):
        """The whole point of storing a normalized label."""
        _, _, account, client = context
        make_txn(account, amount="-10.00", label="CAFE CREME")

        for term in ("café", "CAFÉ", "cafe crème", "creme"):
            assert len(_rows(client.get(f"{LIST_URL}?q={term}"))) == 1, term

    def test_search_misses_are_empty(self, context):
        _, _, account, client = context
        make_txn(account, amount="-10.00", label="CAFE")
        assert _rows(client.get(f"{LIST_URL}?q=boulangerie")) == []

    def test_malformed_date_is_a_400_not_a_silent_ignore(self, context):
        """A silently dropped filter makes the user trust a wrong list."""
        _, _, _, client = context
        response = client.get(f"{LIST_URL}?date_from=pas-une-date")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "date_from" in response.json()

    def test_unknown_direction_is_a_400(self, context):
        _, _, _, client = context
        response = client.get(f"{LIST_URL}?direction=sideways")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTransactionIsImmutable:
    def test_qualify_sets_internal_and_notes(self, context):
        _, _, account, client = context
        txn = make_txn(account, amount="-100.00", label="RETRAIT DAB")

        response = client.patch(
            f"{LIST_URL}{txn.id}/qualify/",
            {"is_internal": True, "notes": "retrait pour le marché"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        txn.refresh_from_db()
        assert txn.is_internal is True
        assert txn.notes == "retrait pour le marché"

    def test_qualify_without_a_field_is_a_400(self, context):
        _, _, account, client = context
        txn = make_txn(account, amount="-10.00")
        response = client.patch(f"{LIST_URL}{txn.id}/qualify/", {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_amount_and_label_cannot_be_rewritten(self, context):
        """This is what the bank says — correcting it would destroy the reference."""
        _, _, account, client = context
        txn = make_txn(account, amount="-32.50", label="CB LECLERC")

        client.patch(
            f"{LIST_URL}{txn.id}/qualify/",
            {"is_internal": True, "amount": "-1.00", "label_raw": "PIRATE"},
            format="json",
        )

        txn.refresh_from_db()
        assert txn.amount == Decimal("-32.50")
        assert txn.label_raw == "CB LECLERC"

    def test_delete_is_not_allowed(self, context):
        _, _, account, client = context
        txn = make_txn(account, amount="-10.00")
        response = client.delete(f"{LIST_URL}{txn.id}/")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_cannot_qualify_another_households_transaction(self, context):
        _, _, _, client = context
        stranger_account = BankAccountFactory(household=HouseholdFactory())
        txn = make_txn(stranger_account, amount="-10.00")

        response = client.patch(
            f"{LIST_URL}{txn.id}/qualify/", {"is_internal": True}, format="json"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        txn.refresh_from_db()
        assert txn.is_internal is False


@pytest.mark.django_db
class TestFlowEndpoint:
    def test_returns_signed_split(self, context):
        _, _, account, client = context
        make_txn(account, amount="-32.50")
        make_txn(account, amount="2100.00", label="VIR SALAIRE")

        body = client.get(FLOW_URL).json()

        assert body["outflow"] == "32.50"
        assert body["inflow"] == "2100.00"
        assert body["net"] == "2067.50"

    def test_excludes_internal_movements(self, context):
        _, _, account, client = context
        make_txn(account, amount="-32.50")
        make_txn(account, amount="-100.00", internal=True, label="RETRAIT DAB")

        body = client.get(FLOW_URL).json()

        assert body["outflow"] == "32.50"
        assert body["internal_count"] == 1

    def test_scoped_to_an_account_and_period(self, context):
        household, _, account, client = context
        other = BankAccountFactory(household=household, name="Second")
        make_txn(account, amount="-10.00", booked_on=date(2026, 7, 1))
        make_txn(other, amount="-99.00", booked_on=date(2026, 7, 1))

        body = client.get(
            f"{FLOW_URL}?account={account.id}&date_from=2026-07-01&date_to=2026-07-31"
        ).json()

        assert body["outflow"] == "10.00"

    def test_unknown_account_is_a_400(self, context):
        _, _, _, client = context
        stranger = BankAccountFactory(household=HouseholdFactory())
        response = client.get(f"{FLOW_URL}?account={stranger.id}")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# --- Cash expense (parcours 26, lot 4) ---------------------------------------


@pytest.mark.django_db
class TestCashExpenseEndpoint:
    """POST /api/banking/transactions/cash-expense/.

    One call, two writes, one transaction: the operation and its allocation. The
    endpoint exists so a cash spend never lands in the app as an expense the bank
    never saw — an écart the control could only report, never resolve.
    """

    URL = "/api/banking/transactions/cash-expense/"

    def _cash_account(self, household, user):
        from banking.models import BankAccount
        from banking.services import create_account

        return create_account(
            household=household,
            user=user,
            name="Espèces",
            kind=BankAccount.Kind.CASH,
            opening_balance="200.00",
            opening_balance_date="2026-01-01",
        )

    def test_records_the_line_and_its_allocation(self):
        household = HouseholdFactory()
        user = _make_member(household)
        account = self._cash_account(household, user)
        budget = Budget.objects.create(household=household, name="Courses", monthly_amount=400)

        response = _client_for(user).post(
            self.URL,
            {
                "account": str(account.id),
                "label": "Marché",
                "amount": "18.50",
                "booked_on": "2026-03-10",
                "budget_id": str(budget.id),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["transaction"]["amount"] == "-18.50"
        assert len(body["allocations"]) == 1
        assert body["allocations"][0]["amount"] == "18.50"

    def test_defaults_to_today_without_a_date(self):
        household = HouseholdFactory()
        user = _make_member(household)
        account = self._cash_account(household, user)

        response = _client_for(user).post(
            self.URL,
            {"account": str(account.id), "label": "Boulangerie", "amount": "4.20"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["transaction"]["booked_on"] == date.today().isoformat()

    def test_a_missing_account_is_a_400(self):
        household = HouseholdFactory()
        user = _make_member(household)
        response = _client_for(user).post(
            self.URL, {"label": "Marché", "amount": "18.50"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "account" in response.json()

    def test_an_account_from_another_household_is_a_400(self):
        household = HouseholdFactory()
        user = _make_member(household)
        foreign = BankAccountFactory(household=HouseholdFactory())

        response = _client_for(user).post(
            self.URL,
            {"account": str(foreign.id), "label": "Marché", "amount": "18.50"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_non_numeric_amount_is_a_400_not_a_500(self):
        household = HouseholdFactory()
        user = _make_member(household)
        account = self._cash_account(household, user)

        response = _client_for(user).post(
            self.URL,
            {"account": str(account.id), "label": "Marché", "amount": "beaucoup"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "amount" in response.json()

    def test_a_malformed_date_is_a_400(self):
        household = HouseholdFactory()
        user = _make_member(household)
        account = self._cash_account(household, user)

        response = _client_for(user).post(
            self.URL,
            {
                "account": str(account.id),
                "label": "Marché",
                "amount": "18.50",
                "booked_on": "10/03/2026",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_requires_authentication(self):
        assert APIClient().post(self.URL, {}, format="json").status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
