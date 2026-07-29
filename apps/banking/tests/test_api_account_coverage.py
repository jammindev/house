# banking/tests/test_api_account_coverage.py
"""``GET /accounts/{id}/coverage/`` — ce que le contrôle peut affirmer d'un compte.

Le point de cet endpoint n'est pas de renvoyer deux dates : c'est de renvoyer une
**raison** quand il n'y en a pas. Un compte sans fenêtre a trois causes possibles,
dont une seule est anodine (rien d'importé), et les confondre a déjà produit en
prod une coche verte « tout est affecté » sur un compte dont *aucun* contrôle ne
portait sur les lignes. La page d'un compte lit ce champ pour ne jamais refaire
cette promesse.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.models import (
    BankTransaction,
    ImportStatus,
    StatementImport,
    TransactionDirection,
)
from households.models import HouseholdMember

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

ACCOUNTS_URL = "/api/banking/accounts/"

_counter = itertools.count()


def make_txn(account, *, booked_on, amount="-10.00", label="CB LECLERC"):
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


def make_import(account, *, start, end, status_=ImportStatus.COMPLETED):
    return StatementImport.objects.create(
        household=account.household,
        account=account,
        provider="generic_csv",
        filename="releve.csv",
        status=status_,
        period_start=start,
        period_end=end,
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
    account = BankAccountFactory(household=household, name="Compte joint")
    return household, user, account, client


@pytest.mark.django_db
class TestTheWindowIsReportedWithItsReason:
    def test_a_covered_account_returns_its_bounds(self, context):
        _, _, account, client = context
        account.opening_balance_date = date(2026, 1, 1)
        account.save(update_fields=["opening_balance_date"])
        make_txn(account, booked_on=date(2026, 3, 10))

        body = client.get(f"{ACCOUNTS_URL}{account.id}/coverage/").json()

        assert body["status"] == ""
        assert body["start"] == "2026-01-01"
        assert body["end"] == "2026-03-10"
        assert body["transaction_count"] == 1
        assert body["first_line"] == "2026-03-10"
        assert body["last_line"] == "2026-03-10"

    def test_a_missing_opening_date_is_named_not_silent(self, context):
        _, _, account, client = context
        make_txn(account, booked_on=date(2026, 3, 10))

        body = client.get(f"{ACCOUNTS_URL}{account.id}/coverage/").json()

        assert body["status"] == "no_opening_date"
        assert body["start"] is None and body["end"] is None
        # La ligne existe : c'est ce qui rend l'écart résoluble plutôt qu'abstrait.
        assert body["transaction_count"] == 1

    def test_an_opening_date_after_the_data_is_distinguished_from_an_empty_account(
        self, context
    ):
        """Le cas silencieux : la date est remplie, et pourtant rien n'est contrôlé.

        Il doit se lire autrement qu'un compte neuf — c'est exactement la confusion
        qui a fait shipper une coche verte sur un compte non vérifié.
        """
        _, _, account, client = context
        account.opening_balance_date = date(2026, 7, 1)
        account.save(update_fields=["opening_balance_date"])
        make_txn(account, booked_on=date(2026, 3, 10))

        body = client.get(f"{ACCOUNTS_URL}{account.id}/coverage/").json()

        assert body["status"] == "opening_date_after_data"
        assert body["start"] is None
        # Le front dit « ta plus ancienne opération est du … » : sans cette date,
        # le message ne peut pas nommer ce qu'il reproche.
        assert body["first_line"] == "2026-03-10"

    def test_an_account_with_nothing_imported_is_not_a_problem(self, context):
        _, _, account, client = context
        account.opening_balance_date = date(2026, 1, 1)
        account.save(update_fields=["opening_balance_date"])

        body = client.get(f"{ACCOUNTS_URL}{account.id}/coverage/").json()

        assert body["status"] == "no_data"
        assert body["transaction_count"] == 0
        assert body["first_line"] is None


@pytest.mark.django_db
class TestGapsFollowTheSameBound:
    def test_a_hole_between_two_imported_periods_is_reported(self, context):
        _, _, account, client = context
        account.opening_balance_date = date(2026, 1, 1)
        account.save(update_fields=["opening_balance_date"])
        make_txn(account, booked_on=date(2026, 1, 15))
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_import(account, start=date(2026, 3, 1), end=date(2026, 3, 31))

        body = client.get(f"{ACCOUNTS_URL}{account.id}/coverage/").json()

        assert body["end"] == "2026-03-31"
        assert body["gaps"] == [
            {"gap_start": "2026-02-01", "gap_end": "2026-02-28", "days": 28}
        ]

    def test_contiguous_periods_report_nothing(self, context):
        _, _, account, client = context
        account.opening_balance_date = date(2026, 1, 1)
        account.save(update_fields=["opening_balance_date"])
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_import(account, start=date(2026, 2, 1), end=date(2026, 2, 28))

        assert client.get(f"{ACCOUNTS_URL}{account.id}/coverage/").json()["gaps"] == []


@pytest.mark.django_db
class TestScope:
    def test_another_households_account_is_not_readable(self, context):
        _, _, _, client = context
        stranger = BankAccountFactory(household=HouseholdFactory(), name="Ailleurs")

        response = client.get(f"{ACCOUNTS_URL}{stranger.id}/coverage/")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_it_needs_authentication(self, context):
        _, _, account, _ = context

        response = APIClient().get(f"{ACCOUNTS_URL}{account.id}/coverage/")

        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
