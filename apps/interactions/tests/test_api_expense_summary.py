"""Tests for GET /api/interactions/expenses/summary/."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from interactions.models import Interaction, InteractionZone
from zones.models import Zone


def _create_household(name: str) -> Household:
    return Household.objects.create(name=name)


def _add_membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _create_zone(household, user, name: str) -> Zone:
    return Zone.objects.create(household=household, name=name, created_by=user)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _create_expense(household, user, zone, *, amount, occurred_at,
                    kind='manual', supplier='', subject='Expense'):
    interaction = Interaction.objects.create(
        household=household,
        created_by=user,
        subject=subject,
        type='expense',
        occurred_at=occurred_at,
        metadata={
            'kind': kind,
            'amount': str(amount) if amount is not None else None,
            'supplier': supplier,
        },
    )
    if zone is not None:
        InteractionZone.objects.create(interaction=interaction, zone=zone)
    return interaction


@pytest.fixture
def owner(db):
    return UserFactory(email="expense-summary-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _create_household("Summary House")
    _add_membership(owner, instance, role=HouseholdMember.Role.OWNER)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def zone(household, owner):
    return _create_zone(household, owner, "Kitchen")


@pytest.mark.django_db
class TestExpenseSummary:
    def url(self):
        return reverse("interaction-expenses-summary")

    def test_empty_household_returns_zeros(self, owner_client):
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "0.00"
        assert response.data["count"] == 0
        assert response.data["by_kind"] == []
        assert response.data["by_supplier"] == []
        assert response.data["by_month"] == []

    def test_single_expense_in_current_month(self, owner_client, household, owner, zone):
        _create_expense(
            household, owner, zone,
            amount=Decimal("42.50"), occurred_at=timezone.now(),
            kind="stock_purchase", supplier="Brico",
        )
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "42.50"
        assert response.data["count"] == 1
        assert response.data["by_kind"] == [
            {"kind": "stock_purchase", "total": "42.50", "count": 1},
        ]
        assert response.data["by_supplier"] == [
            {"supplier": "Brico", "total": "42.50", "count": 1},
        ]
        assert len(response.data["by_month"]) == 1

    def test_multiple_expenses_aggregate_correctly(self, owner_client, household, owner, zone):
        now = timezone.now()
        _create_expense(household, owner, zone, amount=Decimal("100.00"),
                        occurred_at=now, kind="stock_purchase", supplier="Brico")
        _create_expense(household, owner, zone, amount=Decimal("250.50"),
                        occurred_at=now, kind="equipment_purchase", supplier="Castorama")
        _create_expense(household, owner, zone, amount=Decimal("32.00"),
                        occurred_at=now, kind="manual", supplier="")

        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "382.50"
        assert response.data["count"] == 3
        kinds = {row["kind"]: row for row in response.data["by_kind"]}
        assert kinds["stock_purchase"]["total"] == "100.00"
        assert kinds["equipment_purchase"]["total"] == "250.50"
        assert kinds["manual"]["total"] == "32.00"

    def test_amount_null_is_skipped_in_total(self, owner_client, household, owner, zone):
        _create_expense(household, owner, zone, amount=Decimal("10.00"),
                        occurred_at=timezone.now(), kind="manual")
        _create_expense(household, owner, zone, amount=None,
                        occurred_at=timezone.now(), kind="manual")
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        # Two expenses, but only one has an amount: count=2, total=10.00
        assert response.data["total"] == "10.00"
        assert response.data["count"] == 2

    def test_filter_by_supplier(self, owner_client, household, owner, zone):
        now = timezone.now()
        _create_expense(household, owner, zone, amount=Decimal("100.00"),
                        occurred_at=now, kind="stock_purchase", supplier="Engie")
        _create_expense(household, owner, zone, amount=Decimal("200.00"),
                        occurred_at=now, kind="stock_purchase", supplier="Brico")
        response = owner_client.get(self.url() + "?supplier=Engie")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "100.00"
        assert response.data["count"] == 1

    def test_filter_by_kind(self, owner_client, household, owner, zone):
        now = timezone.now()
        _create_expense(household, owner, zone, amount=Decimal("100.00"),
                        occurred_at=now, kind="stock_purchase")
        _create_expense(household, owner, zone, amount=Decimal("200.00"),
                        occurred_at=now, kind="equipment_purchase")
        response = owner_client.get(self.url() + "?kind=equipment_purchase")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "200.00"
        assert response.data["count"] == 1

    def test_period_filter_excludes_outside_dates(self, owner_client, household, owner, zone):
        now = timezone.now()
        last_year = now - timedelta(days=400)
        _create_expense(household, owner, zone, amount=Decimal("999.00"),
                        occurred_at=last_year, kind="manual")
        _create_expense(household, owner, zone, amount=Decimal("10.00"),
                        occurred_at=now, kind="manual")

        from_param = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        to_param = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        response = owner_client.get(f"{self.url()}?from={from_param}&to={to_param}")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "10.00"
        assert response.data["count"] == 1

    def test_default_period_is_current_month(self, owner_client, household, owner, zone):
        now = timezone.now()
        last_month = (now.replace(day=1) - timedelta(days=1))
        _create_expense(household, owner, zone, amount=Decimal("500.00"),
                        occurred_at=last_month, kind="manual")
        _create_expense(household, owner, zone, amount=Decimal("75.00"),
                        occurred_at=now, kind="manual")
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "75.00"
        assert response.data["count"] == 1

    def test_scope_other_household_excluded(self, owner_client, household, owner, zone):
        other = _create_household("Other House")
        _add_membership(owner, other)
        other_zone = _create_zone(other, owner, "Other Kitchen")
        _create_expense(other, owner, other_zone, amount=Decimal("9999.99"),
                        occurred_at=timezone.now(), kind="manual")
        _create_expense(household, owner, zone, amount=Decimal("1.00"),
                        occurred_at=timezone.now(), kind="manual")
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        # Only expenses from selected household should be counted.
        assert response.data["total"] == "1.00"
        assert response.data["count"] == 1

    def test_non_expense_interactions_are_excluded(self, owner_client, household, owner, zone):
        Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Note",
            type="note",
            occurred_at=timezone.now(),
            metadata={"amount": "1000.00"},
        )
        _create_expense(household, owner, zone, amount=Decimal("12.00"),
                        occurred_at=timezone.now(), kind="manual")
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "12.00"
        assert response.data["count"] == 1


@pytest.mark.django_db
class TestExpenseListFilters:
    """Verify the new metadata.kind / metadata.supplier filters on the list endpoint."""

    def test_list_filtered_by_kind(self, owner_client, household, owner, zone):
        _create_expense(household, owner, zone, amount=Decimal("10.00"),
                        occurred_at=timezone.now(), kind="stock_purchase",
                        subject="Stock buy")
        _create_expense(household, owner, zone, amount=Decimal("20.00"),
                        occurred_at=timezone.now(), kind="manual",
                        subject="Manual buy")
        response = owner_client.get(reverse("interaction-list") + "?type=expense&kind=manual")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["subject"] == "Manual buy"

    def test_list_filtered_by_supplier(self, owner_client, household, owner, zone):
        _create_expense(household, owner, zone, amount=Decimal("10.00"),
                        occurred_at=timezone.now(), kind="stock_purchase", supplier="Brico",
                        subject="With supplier")
        _create_expense(household, owner, zone, amount=Decimal("20.00"),
                        occurred_at=timezone.now(), kind="manual", supplier="",
                        subject="No supplier")
        response = owner_client.get(reverse("interaction-list") + "?type=expense&supplier=Brico")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["subject"] == "With supplier"
