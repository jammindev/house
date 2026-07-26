# banking/tests/test_api_accounts.py
"""
REST API tests for BankAccountViewSet (/api/banking/accounts/).

Coverage per section:
  1. TestAccountList     — scoping, cross-household isolation, archived filter
  2. TestAccountCreate   — happy path, member access, anonymous 401, validation
  3. TestAccountUpdate   — PATCH happy path + cross-household
  4. TestAccountDelete   — DELETE archives instead of destroying
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from banking.models import BankAccount
from banking.services import create_account
from households.models import HouseholdMember

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory

LIST_URL = "/api/banking/accounts/"


def _make_member(household, role=HouseholdMember.Role.MEMBER):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=role)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _results(response) -> list:
    """Rows of a list response, whether or not pagination is enabled."""
    body = response.json()
    return body["results"] if isinstance(body, dict) else body


def _payload(**overrides) -> dict:
    payload = {"name": "Compte joint", "bank_label": "LCL", "kind": "bank", "currency": "EUR"}
    payload.update(overrides)
    return payload


@pytest.mark.django_db
class TestAccountList:
    def test_lists_own_household_accounts(self):
        household = HouseholdFactory()
        user = _make_member(household)
        create_account(household=household, user=user, name="Compte joint")

        response = _client_for(user).get(LIST_URL)

        assert response.status_code == status.HTTP_200_OK
        assert [a["name"] for a in _results(response)] == ["Compte joint"]

    def test_does_not_leak_another_household(self):
        mine, theirs = HouseholdFactory(), HouseholdFactory()
        user = _make_member(mine)
        other_user = _make_member(theirs)
        create_account(household=theirs, user=other_user, name="Leur compte")

        response = _client_for(user).get(LIST_URL)

        assert _results(response) == []

    def test_archived_hidden_by_default_and_visible_on_demand(self):
        household = HouseholdFactory()
        user = _make_member(household)
        create_account(household=household, user=user, name="Actif")
        create_account(household=household, user=user, name="Fermé", archived=True)
        client = _client_for(user)

        assert [a["name"] for a in _results(client.get(LIST_URL))] == ["Actif"]

        with_archived = _results(client.get(f"{LIST_URL}?archived=true"))
        assert {a["name"] for a in with_archived} == {"Actif", "Fermé"}

    def test_anonymous_is_rejected(self):
        assert APIClient().get(LIST_URL).status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestAccountCreate:
    def test_member_can_create(self):
        household = HouseholdFactory()
        user = _make_member(household)

        response = _client_for(user).post(LIST_URL, _payload(), format="json")

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["name"] == "Compte joint"
        assert body["kind"] == "bank"
        assert body["archived"] is False
        assert BankAccount.objects.filter(household=household, name="Compte joint").exists()

    def test_cash_account_without_bank_fields(self):
        household = HouseholdFactory()
        user = _make_member(household)

        response = _client_for(user).post(
            LIST_URL, {"name": "Espèces", "kind": "cash"}, format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["kind"] == "cash"
        assert body["bank_label"] == ""
        assert body["iban_last4"] == ""

    def test_duplicate_name_returns_400(self):
        household = HouseholdFactory()
        user = _make_member(household)
        client = _client_for(user)
        client.post(LIST_URL, _payload(), format="json")

        response = client.post(LIST_URL, _payload(), format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.json()

    def test_blank_name_returns_400(self):
        household = HouseholdFactory()
        user = _make_member(household)

        response = _client_for(user).post(LIST_URL, _payload(name="   "), format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.json()

    def test_full_iban_returns_400(self):
        household = HouseholdFactory()
        user = _make_member(household)

        response = _client_for(user).post(
            LIST_URL, _payload(iban_last4="FR7630006000011234567890189"), format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "iban_last4" in response.json()

    def test_negative_opening_balance_is_accepted(self):
        household = HouseholdFactory()
        user = _make_member(household)

        response = _client_for(user).post(
            LIST_URL,
            _payload(opening_balance="-250.40", opening_balance_date="2026-01-01"),
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert Decimal(response.json()["opening_balance"]) == Decimal("-250.40")

    def test_anonymous_cannot_create(self):
        response = APIClient().post(LIST_URL, _payload(), format="json")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestAccountUpdate:
    def test_member_can_patch(self):
        household = HouseholdFactory()
        user = _make_member(household)
        account = create_account(household=household, user=user, name="Old")

        response = _client_for(user).patch(
            f"{LIST_URL}{account.id}/", {"name": "New"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        account.refresh_from_db()
        assert account.name == "New"

    def test_cannot_patch_another_household_account(self):
        mine, theirs = HouseholdFactory(), HouseholdFactory()
        user = _make_member(mine)
        other_user = _make_member(theirs)
        account = create_account(household=theirs, user=other_user, name="Leur compte")

        response = _client_for(user).patch(
            f"{LIST_URL}{account.id}/", {"name": "Hacked"}, format="json"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        account.refresh_from_db()
        assert account.name == "Leur compte"

    def test_import_options_are_read_only(self):
        household = HouseholdFactory()
        user = _make_member(household)
        account = create_account(household=household, user=user, name="Compte joint")

        response = _client_for(user).patch(
            f"{LIST_URL}{account.id}/",
            {"import_options": {"date_column": "hacked"}, "default_provider": "hacked"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        account.refresh_from_db()
        assert account.import_options == {}
        assert account.default_provider == ""


@pytest.mark.django_db
class TestAccountDelete:
    def test_delete_archives_instead_of_destroying(self):
        household = HouseholdFactory()
        user = _make_member(household)
        account = create_account(household=household, user=user, name="Compte joint")

        response = _client_for(user).delete(f"{LIST_URL}{account.id}/")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        account.refresh_from_db()
        assert account.archived is True

    def test_archived_account_can_be_reopened(self):
        """Backs the "rouvrir" action on the archived list — archiving is reversible."""
        household = HouseholdFactory()
        user = _make_member(household)
        account = create_account(household=household, user=user, name="Compte joint")
        client = _client_for(user)
        client.delete(f"{LIST_URL}{account.id}/")

        response = client.patch(
            f"{LIST_URL}{account.id}/?archived=true", {"archived": False}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        account.refresh_from_db()
        assert account.archived is False

    def test_cannot_delete_another_household_account(self):
        mine, theirs = HouseholdFactory(), HouseholdFactory()
        user = _make_member(mine)
        other_user = _make_member(theirs)
        account = create_account(household=theirs, user=other_user, name="Leur compte")

        response = _client_for(user).delete(f"{LIST_URL}{account.id}/")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        account.refresh_from_db()
        assert account.archived is False
