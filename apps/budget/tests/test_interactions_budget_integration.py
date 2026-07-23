# budget/tests/test_interactions_budget_integration.py
"""
Integration tests for the budget ↔ interactions layer.

Covers:
  1. create_manual_expense_interaction with budget_id attaches the budget
  2. Budget from another household raises ValueError
  3. Global budget id raises ValueError (cannot attach to the global cap)
  4. POST /api/interactions/expenses/manual/ with budget_id (REST path)
  5. Deleting a budget sets interaction.budget to NULL (SET_NULL, not cascade)
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from budget.models import Budget
from budget.services import create_budget, delete_budget
from households.models import HouseholdMember
from interactions.models import Interaction
from interactions.services import create_manual_expense_interaction

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# Service-layer tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestManualExpenseWithBudget:
    """Service tests: create_manual_expense_interaction with budget_id."""

    def _create_budget(self, hh, user, **kwargs):
        return _create_budget_helper(hh, user, **kwargs)

    def test_attaches_budget_when_valid(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        budget = _create_budget_helper(hh, user, name="Groceries", monthly_amount=Decimal("400"))
        interaction = create_manual_expense_interaction(
            household=hh,
            user=user,
            subject="Supermarket",
            amount=Decimal("75.00"),
            budget_id=budget.id,
        )
        assert interaction.budget_id == budget.id
        # DB state
        from_db = Interaction.objects.get(id=interaction.id)
        assert from_db.budget_id == budget.id

    def test_no_budget_id_leaves_budget_null(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        interaction = create_manual_expense_interaction(
            household=hh,
            user=user,
            subject="Cinema",
            amount=Decimal("12.00"),
            budget_id=None,
        )
        assert interaction.budget_id is None

    def test_cross_household_budget_raises(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        user_a = _make_owner(hh_a)
        user_b = _make_owner(hh_b)
        budget_b = _create_budget_helper(hh_b, user_b, name="Other HH Budget", monthly_amount=Decimal("200"))
        with pytest.raises(ValueError):
            create_manual_expense_interaction(
                household=hh_a,
                user=user_a,
                subject="Test",
                amount=Decimal("10.00"),
                budget_id=budget_b.id,
            )

    def test_global_budget_id_raises(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        global_budget = _create_budget_helper(
            hh, user, name="Total Cap", monthly_amount=Decimal("2000"), is_global=True
        )
        with pytest.raises(ValueError) as exc_info:
            create_manual_expense_interaction(
                household=hh,
                user=user,
                subject="Test",
                amount=Decimal("10.00"),
                budget_id=global_budget.id,
            )
        assert "global" in str(exc_info.value).lower()

    def test_delete_budget_sets_interaction_budget_null(self):
        """Deleting the budget must not delete the expense (SET_NULL)."""
        hh = HouseholdFactory()
        user = _make_owner(hh)
        budget = _create_budget_helper(hh, user, name="Groceries", monthly_amount=Decimal("400"))
        interaction = create_manual_expense_interaction(
            household=hh,
            user=user,
            subject="Supermarket",
            amount=Decimal("50.00"),
            budget_id=budget.id,
        )
        interaction_id = interaction.id
        delete_budget(hh, user, budget)
        # Interaction still exists
        refreshed = Interaction.objects.get(id=interaction_id)
        assert refreshed.budget_id is None  # SET_NULL, not cascade


# ---------------------------------------------------------------------------
# REST endpoint integration test
# ---------------------------------------------------------------------------


def _create_budget_helper(hh, user, **kwargs):
    defaults = {"name": "Groceries", "monthly_amount": Decimal("400")}
    defaults.update(kwargs)
    return create_budget(hh, user, **defaults)


@pytest.mark.django_db
class TestManualExpenseEndpointWithBudget:
    """POST /api/interactions/expenses/manual/ — budget_id integration via REST."""

    def test_budget_id_attaches_budget_via_rest(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        budget = _create_budget_helper(hh, user, name="Groceries")
        client = _client_for(user)
        response = client.post(
            reverse("interaction-expenses-manual"),
            data={
                "subject": "Supermarket run",
                "amount": "60.00",
                "budget_id": str(budget.id),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.content
        interaction = Interaction.objects.get(id=response.data["id"])
        assert interaction.budget_id == budget.id

    def test_cross_household_budget_via_rest_returns_400(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        user_a = _make_owner(hh_a)
        user_b = _make_owner(hh_b)
        budget_b = _create_budget_helper(hh_b, user_b, name="Foreign Budget")
        client_a = _client_for(user_a)
        response = client_a.post(
            reverse("interaction-expenses-manual"),
            data={
                "subject": "Test",
                "amount": "10.00",
                "budget_id": str(budget_b.id),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_global_budget_via_rest_returns_400(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        global_budget = _create_budget_helper(
            hh, user, name="Total Cap", monthly_amount=Decimal("2000"), is_global=True
        )
        client = _client_for(user)
        response = client.post(
            reverse("interaction-expenses-manual"),
            data={
                "subject": "Test",
                "amount": "10.00",
                "budget_id": str(global_budget.id),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_null_budget_id_creates_unbudgeted_expense(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        client = _client_for(user)
        response = client.post(
            reverse("interaction-expenses-manual"),
            data={"subject": "Cinema", "amount": "12.00", "budget_id": None},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.content
        assert Interaction.objects.get(id=response.data["id"]).budget_id is None
