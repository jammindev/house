# budget/tests/test_api_budget.py
"""
REST API tests for the BudgetViewSet (/api/budget/budgets/).

Coverage per section:
  1. TestBudgetList         — list scoping + cross-household isolation
  2. TestBudgetCreate       — happy-path, member access, anonymous 401, validation
  3. TestBudgetRetrieve     — detail read + cross-household 403/404
  4. TestBudgetUpdate       — PATCH happy-path, member access, cross-household
  5. TestBudgetDelete       — DELETE happy-path, member access, cross-household
  6. TestBudgetOverview     — aggregated monthly view with state transitions
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from budget.models import Budget
from budget.services import create_budget
from households.models import Household, HouseholdMember
from interactions.services import create_manual_expense_interaction

from .factories import BudgetFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _make_owner(household) -> "User":
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _make_member(household) -> "User":
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _anon_client() -> APIClient:
    return APIClient()


def _create_budget(household, user, **kwargs) -> Budget:
    defaults = {"name": "Groceries", "monthly_amount": Decimal("400")}
    defaults.update(kwargs)
    return create_budget(household, user, **defaults)


def _budget_payload(**overrides) -> dict:
    payload = {"name": "Transport", "monthly_amount": "150.00", "is_global": False}
    payload.update(overrides)
    return payload


# ===========================================================================
# 1. TestBudgetList
# ===========================================================================


@pytest.mark.django_db
class TestBudgetList:
    """GET /api/budget/budgets/ — household scoping and cross-household isolation."""

    def _create_budget(self, household, user, **kwargs):
        return _create_budget(household, user, **kwargs)

    def _budget_payload(self, **overrides):
        return _budget_payload(**overrides)

    def test_owner_sees_own_budgets(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Groceries")
        self._create_budget(hh, owner, name="Transport")
        client = _client_for(owner)
        response = client.get(reverse("budget-list"))
        assert response.status_code == status.HTTP_200_OK
        names = {b["name"] for b in response.data}
        assert "Groceries" in names
        assert "Transport" in names

    def test_cross_household_budgets_not_visible(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        self._create_budget(hh_b, owner_b, name="Secret Budget")
        client = _client_for(owner_a)
        response = client.get(reverse("budget-list"))
        assert response.status_code == status.HTTP_200_OK
        names = {b["name"] for b in response.data}
        assert "Secret Budget" not in names

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("budget-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_can_list(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        client = _client_for(member)
        response = client.get(reverse("budget-list"))
        assert response.status_code == status.HTTP_200_OK


# ===========================================================================
# 2. TestBudgetCreate
# ===========================================================================


@pytest.mark.django_db
class TestBudgetCreate:
    """POST /api/budget/budgets/ — creates a budget, validates input."""

    def _create_budget(self, household, user, **kwargs):
        return _create_budget(household, user, **kwargs)

    def _budget_payload(self, **overrides):
        return _budget_payload(**overrides)

    def test_owner_creates_budget(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        payload = self._budget_payload(name="Transport", monthly_amount="150.00")
        response = client.post(reverse("budget-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Transport"
        assert response.data["monthly_amount"] == "150.00"
        # DB state
        budget = Budget.objects.get(id=response.data["id"])
        assert budget.household == hh
        assert budget.name == "Transport"
        assert budget.monthly_amount == Decimal("150.00")

    def test_member_can_create_budget(self):
        """Any household member (not only owner) may create a budget."""
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        client = _client_for(member)
        payload = self._budget_payload(name="Member Budget")
        response = client.post(reverse("budget-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        budget = Budget.objects.get(id=response.data["id"])
        assert budget.household == hh

    def test_anonymous_gets_401(self):
        response = _anon_client().post(
            reverse("budget-list"), self._budget_payload(), format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_can_create_global_budget(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(
            reverse("budget-list"),
            self._budget_payload(name="Global Cap", is_global=True),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Budget.objects.get(id=response.data["id"]).is_global is True

    def test_second_global_budget_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="First Global", is_global=True)
        client = _client_for(owner)
        response = client.post(
            reverse("budget-list"),
            self._budget_payload(name="Second Global", is_global=True),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_global" in response.data

    def test_duplicate_name_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Groceries")
        client = _client_for(owner)
        response = client.post(
            reverse("budget-list"),
            self._budget_payload(name="Groceries"),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data

    def test_missing_name_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        payload = {"monthly_amount": "100.00"}
        response = client.post(reverse("budget-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data

    def test_blank_name_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(
            reverse("budget-list"),
            {"name": "   ", "monthly_amount": "100.00"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data

    def test_zero_amount_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(
            reverse("budget-list"),
            self._budget_payload(monthly_amount="0"),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "monthly_amount" in response.data

    def test_negative_amount_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(
            reverse("budget-list"),
            self._budget_payload(monthly_amount="-50"),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "monthly_amount" in response.data

    def test_missing_amount_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(
            reverse("budget-list"), {"name": "Transport"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "monthly_amount" in response.data


# ===========================================================================
# 3. TestBudgetRetrieve
# ===========================================================================


@pytest.mark.django_db
class TestBudgetRetrieve:
    """GET /api/budget/budgets/{id}/ — detail read + cross-household isolation."""

    def _create_budget(self, household, user, **kwargs):
        return _create_budget(household, user, **kwargs)

    def _budget_payload(self, **overrides):
        return _budget_payload(**overrides)

    def test_owner_can_retrieve(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Groceries")
        client = _client_for(owner)
        response = client.get(reverse("budget-detail", args=[budget.id]))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(budget.id)
        assert response.data["name"] == "Groceries"

    def test_member_can_retrieve(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        member = _make_member(hh)
        budget = self._create_budget(hh, owner, name="Groceries")
        client = _client_for(member)
        response = client.get(reverse("budget-detail", args=[budget.id]))
        assert response.status_code == status.HTTP_200_OK

    def test_cross_household_returns_404(self):
        """A user from household B cannot read household A's budget."""
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        budget_a = self._create_budget(hh_a, owner_a, name="Private")
        client_b = _client_for(owner_b)
        response = client_b.get(reverse("budget-detail", args=[budget_a.id]))
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Groceries")
        response = _anon_client().get(reverse("budget-detail", args=[budget.id]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 4. TestBudgetUpdate
# ===========================================================================


@pytest.mark.django_db
class TestBudgetUpdate:
    """PATCH /api/budget/budgets/{id}/ — partial update, member access, isolation."""

    def _create_budget(self, household, user, **kwargs):
        return _create_budget(household, user, **kwargs)

    def _budget_payload(self, **overrides):
        return _budget_payload(**overrides)

    def test_owner_can_patch_name(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Old Name")
        client = _client_for(owner)
        response = client.patch(
            reverse("budget-detail", args=[budget.id]),
            {"name": "New Name"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "New Name"
        assert Budget.objects.get(id=budget.id).name == "New Name"

    def test_owner_can_patch_amount(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner)
        client = _client_for(owner)
        response = client.patch(
            reverse("budget-detail", args=[budget.id]),
            {"monthly_amount": "999.00"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert Budget.objects.get(id=budget.id).monthly_amount == Decimal("999.00")

    def test_member_can_update(self):
        """Any member — not only owner — may update a budget (Lot 1 decision)."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        member = _make_member(hh)
        budget = self._create_budget(hh, owner, name="Groceries")
        client = _client_for(member)
        response = client.patch(
            reverse("budget-detail", args=[budget.id]),
            {"name": "Updated by member"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert Budget.objects.get(id=budget.id).name == "Updated by member"

    def test_cross_household_update_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        budget_a = self._create_budget(hh_a, owner_a, name="Private")
        client_b = _client_for(owner_b)
        response = client_b.patch(
            reverse("budget-detail", args=[budget_a.id]),
            {"name": "Hacked"},
            format="json",
        )
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        # Name must NOT have changed
        assert Budget.objects.get(id=budget_a.id).name == "Private"

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner)
        response = _anon_client().patch(
            reverse("budget-detail", args=[budget.id]),
            {"name": "Anon"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_duplicate_name_on_patch_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Existing")
        budget = self._create_budget(hh, owner, name="Other")
        client = _client_for(owner)
        response = client.patch(
            reverse("budget-detail", args=[budget.id]),
            {"name": "Existing"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data


# ===========================================================================
# 5. TestBudgetDelete
# ===========================================================================


@pytest.mark.django_db
class TestBudgetDelete:
    """DELETE /api/budget/budgets/{id}/ — hard delete, member access, isolation."""

    def _create_budget(self, household, user, **kwargs):
        return _create_budget(household, user, **kwargs)

    def _budget_payload(self, **overrides):
        return _budget_payload(**overrides)

    def test_owner_can_delete(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Groceries")
        budget_id = budget.id
        client = _client_for(owner)
        response = client.delete(reverse("budget-detail", args=[budget_id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Budget.objects.filter(id=budget_id).exists()

    def test_member_can_delete(self):
        """Any member may delete (Lot 1 decision)."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        member = _make_member(hh)
        budget = self._create_budget(hh, owner, name="Groceries")
        budget_id = budget.id
        client = _client_for(member)
        response = client.delete(reverse("budget-detail", args=[budget_id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Budget.objects.filter(id=budget_id).exists()

    def test_cross_household_delete_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        budget_a = self._create_budget(hh_a, owner_a, name="Private")
        client_b = _client_for(owner_b)
        response = client_b.delete(reverse("budget-detail", args=[budget_a.id]))
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        assert Budget.objects.filter(id=budget_a.id).exists()

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner)
        response = _anon_client().delete(reverse("budget-detail", args=[budget.id]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 6. TestBudgetOverview
# ===========================================================================


@pytest.mark.django_db
class TestBudgetOverview:
    """GET /api/budget/budgets/overview/ — shape, aggregation, state transitions."""

    def _create_budget(self, household, user, **kwargs):
        return _create_budget(household, user, **kwargs)

    def _budget_payload(self, **overrides):
        return _budget_payload(**overrides)

    def _make_expense(self, hh, user, amount, budget=None):
        return create_manual_expense_interaction(
            household=hh,
            user=user,
            subject=f"Expense {amount}",
            amount=Decimal(str(amount)),
            occurred_at=timezone.now(),
            budget_id=budget.id if budget else None,
        )

    def test_overview_shape_with_no_budgets(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert "month" in data
        assert "global" in data
        assert "budgets" in data
        assert "unbudgeted" in data
        assert "total_spent" in data
        assert "named_total_amount" in data
        assert "named_exceeds_global" in data
        assert data["global"] is None
        assert data["budgets"] == []

    def test_overview_includes_budget_row(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Groceries", monthly_amount=Decimal("500"))
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["budgets"]) == 1
        row = response.data["budgets"][0]
        assert row["name"] == "Groceries"
        assert row["amount"] == "500.00"
        assert "spent" in row
        assert "ratio" in row
        assert "state" in row

    def test_spent_aggregation_per_named_budget(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        groceries = self._create_budget(hh, owner, name="Groceries", monthly_amount=Decimal("500"))
        self._make_expense(hh, owner, "100.00", budget=groceries)
        self._make_expense(hh, owner, "50.00", budget=groceries)
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        assert response.status_code == status.HTTP_200_OK
        rows = {b["name"]: b for b in response.data["budgets"]}
        assert rows["Groceries"]["spent"] == "150.00"
        assert rows["Groceries"]["ratio"] == pytest.approx(0.3, abs=1e-3)

    def test_unbudgeted_expenses_aggregated_separately(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Groceries", monthly_amount=Decimal("500"))
        # Unbudgeted expense
        self._make_expense(hh, owner, "200.00", budget=None)
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        assert Decimal(response.data["unbudgeted"]) == Decimal("200.00")

    def test_global_budget_spent_equals_total_of_all_expenses(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        groceries = self._create_budget(hh, owner, name="Groceries", monthly_amount=Decimal("500"))
        global_budget = self._create_budget(
            hh, owner, name="Total Cap", monthly_amount=Decimal("2000"), is_global=True
        )
        self._make_expense(hh, owner, "100.00", budget=groceries)
        self._make_expense(hh, owner, "200.00", budget=None)  # unbudgeted
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["global"] is not None
        assert response.data["global"]["id"] == str(global_budget.id)
        # global.spent = all expenses, including unbudgeted
        assert Decimal(response.data["global"]["spent"]) == Decimal("300.00")
        assert Decimal(response.data["total_spent"]) == Decimal("300.00")

    def test_state_ok_when_below_80_percent(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Transport", monthly_amount=Decimal("100"))
        self._make_expense(hh, owner, "70.00", budget=budget)  # 70% ratio
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        row = response.data["budgets"][0]
        assert row["state"] == "ok"

    def test_state_warning_when_at_or_above_80_percent(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Transport", monthly_amount=Decimal("100"))
        self._make_expense(hh, owner, "80.00", budget=budget)  # exactly 80%
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        row = response.data["budgets"][0]
        assert row["state"] == "warning"

    def test_state_over_when_at_or_above_100_percent(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Transport", monthly_amount=Decimal("100"))
        self._make_expense(hh, owner, "100.00", budget=budget)  # exactly 100%
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        row = response.data["budgets"][0]
        assert row["state"] == "over"

    def test_previous_month_expenses_excluded(self):
        """Expenses from a previous month must NOT appear in the current overview."""
        from datetime import datetime, timedelta, timezone as dt_timezone

        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Groceries", monthly_amount=Decimal("500"))
        # Create an expense dated 35 days ago (previous month for any day >= 5)
        past_date = timezone.now() - timedelta(days=35)
        create_manual_expense_interaction(
            household=hh,
            user=owner,
            subject="Old expense",
            amount=Decimal("999.00"),
            occurred_at=past_date,
            budget_id=budget.id,
        )
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        row = response.data["budgets"][0]
        assert Decimal(row["spent"]) == Decimal("0.00")

    def test_named_exceeds_global_flag_set_correctly(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Groceries", monthly_amount=Decimal("1500"))
        self._create_budget(hh, owner, name="Leisure", monthly_amount=Decimal("1000"))
        # Global < sum of named → should flag
        self._create_budget(
            hh, owner, name="Total Cap", monthly_amount=Decimal("2000"), is_global=True
        )
        client = _client_for(owner)
        response = client.get(reverse("budget-overview"))
        assert response.data["named_exceeds_global"] is True

    def test_cross_household_expenses_not_in_overview(self):
        """Another household's expenses must not appear in the household's overview."""
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        budget_a = self._create_budget(hh_a, owner_a, name="Groceries", monthly_amount=Decimal("500"))
        # Expense in household B
        self._make_expense(hh_b, owner_b, "9999.00")
        client_a = _client_for(owner_a)
        response = client_a.get(reverse("budget-overview"))
        assert Decimal(response.data["total_spent"]) == Decimal("0.00")
        row = response.data["budgets"][0]
        assert Decimal(row["spent"]) == Decimal("0.00")

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("budget-overview"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
