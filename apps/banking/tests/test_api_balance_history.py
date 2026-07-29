# banking/tests/test_api_balance_history.py
"""REST tests for the two balance-curve endpoints.

The arithmetic lives in ``test_balance_history.py``. What is checked here is the
contract the front depends on: the window parameters, the shared axis of the
household route, the household scoping, and — once more, across the HTTP
boundary this time — that the curve ends on what ``/balance/`` returns.
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
from households.models import HouseholdMember

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

ACCOUNTS_URL = "/api/banking/accounts/"

_counter = itertools.count()


def make_txn(account, *, amount, booked_on, balance_after=None, label="OP"):
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
def context(db):
    household = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    client = APIClient()
    client.force_authenticate(user=user)
    account = BankAccountFactory(
        household=household,
        name="Compte joint",
        opening_balance=Decimal("1000.00"),
        opening_balance_date=date(2026, 1, 1),
    )
    return household, user, account, client


@pytest.mark.django_db
class TestTheAccountCurve:
    def test_it_returns_dated_points(self, context):
        _, _, account, client = context
        make_txn(account, amount="-100.00", booked_on=date(2026, 2, 10))

        response = client.get(f"{ACCOUNTS_URL}{account.id}/balance-history/?to=2026-02-28")

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["account_id"] == str(account.id)
        assert body["name"] == "Compte joint"
        assert body["source"] == "derived"
        assert body["is_reliable"] is True
        assert body["points"][0] == {"on": "2026-01-01", "amount": "1000.00"}
        assert body["points"][-1] == {"on": "2026-02-28", "amount": "900.00"}

    def test_it_ends_on_what_the_balance_endpoint_says(self, context):
        """⚠️ The same agreement as the unit test, across HTTP.

        The card and the curve are two fetches in one viewport. If they ever
        disagree the user cannot tell which one to believe.
        """
        _, _, account, client = context
        make_txn(account, amount="-120.00", booked_on=date(2026, 3, 4), balance_after="2120.00")
        make_txn(account, amount="-20.00", booked_on=date(2026, 3, 25))

        balance = client.get(f"{ACCOUNTS_URL}{account.id}/balance/").json()
        history = client.get(f"{ACCOUNTS_URL}{account.id}/balance-history/?months=0").json()

        assert history["points"][-1]["amount"] == balance["amount"]

    def test_an_unreliable_chain_is_reported(self, context):
        _, _, account, client = context
        make_txn(account, amount="-10.00", booked_on=date(2026, 3, 1), balance_after="990.00")
        make_txn(account, amount="-20.00", booked_on=date(2026, 3, 10), balance_after="500.00")

        body = client.get(f"{ACCOUNTS_URL}{account.id}/balance-history/?months=0").json()

        assert body["is_reliable"] is False

    def test_another_households_account_is_not_reachable(self, context):
        _, _, _, client = context
        outsider = BankAccountFactory(
            household=HouseholdFactory(), opening_balance_date=date(2026, 1, 1)
        )

        response = client.get(f"{ACCOUNTS_URL}{outsider.id}/balance-history/")

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestTheWindowParameters:
    def test_months_counts_calendar_months_back(self, context):
        _, _, account, client = context

        body = client.get(
            f"{ACCOUNTS_URL}{account.id}/balance-history/?months=3&to=2026-06-15"
        ).json()

        assert body["points"][0]["on"] == "2026-03-15"
        assert body["points"][-1]["on"] == "2026-06-15"

    def test_an_explicit_from_wins_over_months(self, context):
        _, _, account, client = context

        body = client.get(
            f"{ACCOUNTS_URL}{account.id}/balance-history/?months=3&from=2026-02-01&to=2026-06-15"
        ).json()

        assert body["points"][0]["on"] == "2026-02-01"

    def test_months_zero_means_the_whole_life_of_the_account(self, context):
        _, _, account, client = context
        make_txn(account, amount="-100.00", booked_on=date(2026, 2, 10))

        body = client.get(
            f"{ACCOUNTS_URL}{account.id}/balance-history/?months=0&to=2026-02-28"
        ).json()

        assert body["points"][0]["on"] == "2026-01-01"

    @pytest.mark.parametrize("value", ["banane", "-1", "999"])
    def test_a_bad_months_is_a_400_not_a_silent_default(self, context, value):
        """A window that silently falls back is a window the user cannot trust."""
        _, _, account, client = context

        response = client.get(f"{ACCOUNTS_URL}{account.id}/balance-history/?months={value}")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_bad_date_is_a_400(self, context):
        _, _, account, client = context

        response = client.get(f"{ACCOUNTS_URL}{account.id}/balance-history/?to=15-06-2026")

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTheHouseholdCurve:
    def test_every_series_shares_the_axis_of_the_total(self, context):
        household, _, first, client = context
        BankAccountFactory(
            household=household,
            name="Livret",
            opening_balance=Decimal("2000.00"),
            opening_balance_date=date(2026, 2, 1),
        )
        make_txn(first, amount="-100.00", booked_on=date(2026, 2, 10))

        body = client.get(f"{ACCOUNTS_URL}balance-history/?months=0&to=2026-02-28").json()

        axis = [p["on"] for p in body["total"]]
        assert axis[0] == "2026-01-01"
        assert len(body["accounts"]) == 2
        for series in body["accounts"]:
            assert [p["on"] for p in series["points"]] == axis

    def test_the_total_adds_up_on_the_last_point(self, context):
        household, _, first, client = context
        BankAccountFactory(
            household=household,
            name="Livret",
            opening_balance=Decimal("2000.00"),
            opening_balance_date=date(2026, 1, 1),
        )
        make_txn(first, amount="-100.00", booked_on=date(2026, 2, 10))

        body = client.get(f"{ACCOUNTS_URL}balance-history/?months=0&to=2026-02-28").json()

        assert body["total"][-1]["amount"] == "2900.00"

    def test_it_never_leaks_another_household(self, context):
        household, _, _, client = context
        other = BankAccountFactory(
            household=HouseholdFactory(),
            name="Compte du voisin",
            opening_balance_date=date(2026, 1, 1),
        )

        body = client.get(f"{ACCOUNTS_URL}balance-history/?months=0&to=2026-02-28").json()

        assert str(other.id) not in {series["account_id"] for series in body["accounts"]}

    def test_a_household_with_nothing_to_draw_returns_empty_lists(self, db):
        """An empty chart, not a 500 and not a flat zero line."""
        household = HouseholdFactory()
        user = UserFactory()
        HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
        user.active_household = household
        user.save(update_fields=["active_household"])
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get(f"{ACCOUNTS_URL}balance-history/")

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"is_reliable": True, "accounts": [], "total": []}
