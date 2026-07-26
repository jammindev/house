# banking/tests/test_api_balances.py
"""REST tests for the balance endpoint and the cash-counterpart actions."""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.models import BankAccount, BankTransaction, TransactionDirection
from households.models import HouseholdMember

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

ACCOUNTS_URL = "/api/banking/accounts/"
TX_URL = "/api/banking/transactions/"

_counter = itertools.count()


def make_txn(account, *, amount, booked_on=date(2026, 7, 12), balance_after=None, label="OP"):
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
    bank = BankAccountFactory(household=household, name="Compte joint")
    cash = BankAccountFactory(
        household=household, name="Espèces", kind=BankAccount.Kind.CASH, bank_label=""
    )
    return household, user, bank, cash, client


@pytest.mark.django_db
class TestBalanceEndpoint:
    def test_returns_the_anchored_balance(self, context):
        _, _, bank, _, client = context
        make_txn(bank, amount="-10.00", booked_on=date(2026, 7, 1), balance_after="990.00")

        body = client.get(f"{ACCOUNTS_URL}{bank.id}/balance/").json()

        assert body["amount"] == "990.00"
        assert body["source"] == "anchored"
        assert body["is_reliable"] is True
        assert body["gaps"] == []

    def test_reports_a_chain_gap_and_flags_the_balance(self, context):
        _, _, bank, _, client = context
        make_txn(bank, amount="-10.00", booked_on=date(2026, 7, 1), balance_after="990.00")
        make_txn(bank, amount="-20.00", booked_on=date(2026, 7, 20), balance_after="910.00")

        body = client.get(f"{ACCOUNTS_URL}{bank.id}/balance/").json()

        assert body["is_reliable"] is False
        assert len(body["gaps"]) == 1
        gap = body["gaps"][0]
        assert gap["gap_start"] == "2026-07-01"
        assert gap["gap_end"] == "2026-07-20"
        assert gap["missing_amount"] == "-60.00"

    def test_as_of_is_honoured(self, context):
        _, _, bank, _, client = context
        make_txn(bank, amount="-10.00", booked_on=date(2026, 7, 1), balance_after="990.00")
        make_txn(bank, amount="-40.00", booked_on=date(2026, 7, 20), balance_after="950.00")

        body = client.get(f"{ACCOUNTS_URL}{bank.id}/balance/?as_of=2026-07-10").json()

        assert body["amount"] == "990.00"

    def test_malformed_as_of_is_a_400(self, context):
        _, _, bank, _, client = context
        response = client.get(f"{ACCOUNTS_URL}{bank.id}/balance/?as_of=nope")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_another_households_account_is_not_readable(self, context):
        _, _, _, _, client = context
        stranger = BankAccountFactory(household=HouseholdFactory())
        response = client.get(f"{ACCOUNTS_URL}{stranger.id}/balance/")
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestWithdrawToCashEndpoint:
    def test_creates_the_counterpart(self, context):
        _, _, bank, cash, client = context
        withdrawal = make_txn(bank, amount="-100.00", label="RETRAIT DAB")

        response = client.post(
            f"{TX_URL}{withdrawal.id}/withdraw-to-cash/",
            {"cash_account": str(cash.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["amount"] == "100.00"
        assert body["is_internal"] is True
        withdrawal.refresh_from_db()
        assert withdrawal.transfer_counterpart_id is not None

    def test_partial_amount(self, context):
        _, _, bank, cash, client = context
        withdrawal = make_txn(bank, amount="-100.00", label="RETRAIT DAB")

        response = client.post(
            f"{TX_URL}{withdrawal.id}/withdraw-to-cash/",
            {"cash_account": str(cash.id), "amount": "40.00"},
            format="json",
        )

        assert response.json()["amount"] == "40.00"

    def test_missing_cash_account_is_a_400(self, context):
        _, _, bank, _, client = context
        withdrawal = make_txn(bank, amount="-100.00")
        response = client.post(f"{TX_URL}{withdrawal.id}/withdraw-to-cash/", {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_incoming_operation_is_a_400(self, context):
        _, _, bank, cash, client = context
        income = make_txn(bank, amount="2100.00", label="VIR SALAIRE")
        response = client.post(
            f"{TX_URL}{income.id}/withdraw-to-cash/",
            {"cash_account": str(cash.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unlink_removes_the_generated_leg(self, context):
        _, _, bank, cash, client = context
        withdrawal = make_txn(bank, amount="-100.00", label="RETRAIT DAB")
        mirror_id = client.post(
            f"{TX_URL}{withdrawal.id}/withdraw-to-cash/",
            {"cash_account": str(cash.id)},
            format="json",
        ).json()["id"]

        response = client.delete(f"{TX_URL}{withdrawal.id}/unlink-cash/")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not BankTransaction.objects.filter(pk=mirror_id).exists()
        withdrawal.refresh_from_db()
        assert withdrawal.is_internal is False

    def test_plain_delete_on_a_transaction_is_still_405(self, context):
        """Adding the DELETE verb for `unlink-cash` must not open destruction."""
        _, _, bank, _, client = context
        txn = make_txn(bank, amount="-10.00")
        assert client.delete(f"{TX_URL}{txn.id}/").status_code == (
            status.HTTP_405_METHOD_NOT_ALLOWED
        )
