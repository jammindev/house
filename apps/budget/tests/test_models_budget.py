# budget/tests/test_models_budget.py
"""
Model + service layer tests for Budget.

Covers:
- Unique constraints (one global per household, unique name per household)
- create_budget: happy path, positive amount required, non-blank name required
- update_budget: field mutation, unknown fields ignored, uniqueness re-checked
- delete_budget: hard delete, cross-household guard, SET_NULL on expenses
"""
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from budget.models import Budget
from budget.services import create_budget, delete_budget, update_budget
from households.models import HouseholdMember
from interactions.services import create_manual_expense_interaction

from .factories import BudgetFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    return user


def _make_member_pair():
    """Return (household, owner_user)."""
    hh = HouseholdFactory()
    user = _make_owner(hh)
    return hh, user


# ---------------------------------------------------------------------------
# Budget model constraints
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestBudgetConstraints:
    """DB-level uniqueness constraints — exercised directly against the ORM."""

    def test_two_global_budgets_in_same_household_raises_integrity(self):
        hh, user = _make_member_pair()
        create_budget(hh, user, name="Global 1", monthly_amount=Decimal("2000"), is_global=True)
        with pytest.raises(ValidationError) as exc_info:
            create_budget(hh, user, name="Global 2", monthly_amount=Decimal("3000"), is_global=True)
        assert "is_global" in exc_info.value.detail

    def test_duplicate_name_in_same_household_raises(self):
        hh, user = _make_member_pair()
        create_budget(hh, user, name="Groceries", monthly_amount=Decimal("400"))
        with pytest.raises(ValidationError) as exc_info:
            create_budget(hh, user, name="Groceries", monthly_amount=Decimal("500"))
        assert "name" in exc_info.value.detail

    def test_same_name_allowed_in_different_households(self):
        hh1, user1 = _make_member_pair()
        hh2, user2 = _make_member_pair()
        b1 = create_budget(hh1, user1, name="Groceries", monthly_amount=Decimal("400"))
        b2 = create_budget(hh2, user2, name="Groceries", monthly_amount=Decimal("500"))
        assert b1.id != b2.id

    def test_two_global_budgets_allowed_across_households(self):
        hh1, user1 = _make_member_pair()
        hh2, user2 = _make_member_pair()
        b1 = create_budget(hh1, user1, name="Global A", monthly_amount=Decimal("2000"), is_global=True)
        b2 = create_budget(hh2, user2, name="Global B", monthly_amount=Decimal("3000"), is_global=True)
        assert b1.id != b2.id


# ---------------------------------------------------------------------------
# create_budget service
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateBudget:
    """create_budget() — validation + happy-path."""

    def test_creates_named_budget(self):
        hh, user = _make_member_pair()
        budget = create_budget(hh, user, name="Groceries", monthly_amount=Decimal("400"))
        assert budget.id is not None
        assert budget.name == "Groceries"
        assert budget.monthly_amount == Decimal("400.00")
        assert budget.is_global is False
        assert budget.household == hh
        # Verify DB
        from_db = Budget.objects.get(id=budget.id)
        assert from_db.name == "Groceries"
        assert from_db.household == hh

    def test_creates_global_budget(self):
        hh, user = _make_member_pair()
        budget = create_budget(hh, user, name="Total Cap", monthly_amount=Decimal("3000"), is_global=True)
        assert budget.is_global is True
        assert Budget.objects.get(id=budget.id).is_global is True

    def test_amount_zero_raises(self):
        hh, user = _make_member_pair()
        with pytest.raises(ValidationError) as exc_info:
            create_budget(hh, user, name="Free", monthly_amount=Decimal("0"))
        assert "monthly_amount" in exc_info.value.detail

    def test_negative_amount_raises(self):
        hh, user = _make_member_pair()
        with pytest.raises(ValidationError) as exc_info:
            create_budget(hh, user, name="Negative", monthly_amount=Decimal("-10"))
        assert "monthly_amount" in exc_info.value.detail

    def test_blank_name_raises(self):
        hh, user = _make_member_pair()
        with pytest.raises(ValidationError) as exc_info:
            create_budget(hh, user, name="   ", monthly_amount=Decimal("100"))
        assert "name" in exc_info.value.detail

    def test_empty_name_raises(self):
        hh, user = _make_member_pair()
        with pytest.raises(ValidationError) as exc_info:
            create_budget(hh, user, name="", monthly_amount=Decimal("100"))
        assert "name" in exc_info.value.detail

    def test_amount_as_string_accepted(self):
        hh, user = _make_member_pair()
        budget = create_budget(hh, user, name="Transport", monthly_amount="150.50")
        assert budget.monthly_amount == Decimal("150.50")

    def test_created_by_is_set(self):
        hh, user = _make_member_pair()
        budget = create_budget(hh, user, name="Entertainment", monthly_amount=Decimal("200"))
        assert Budget.objects.get(id=budget.id).created_by == user


# ---------------------------------------------------------------------------
# update_budget service
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUpdateBudget:
    """update_budget() — field edits, unknown fields ignored, uniqueness re-checked."""

    def _budget(self, hh, user, **kwargs):
        defaults = {"name": "Groceries", "monthly_amount": Decimal("400")}
        defaults.update(kwargs)
        return create_budget(hh, user, **defaults)

    def test_updates_name(self):
        hh, user = _make_member_pair()
        budget = self._budget(hh, user)
        updated = update_budget(hh, user, budget, fields={"name": "Food"})
        assert updated.name == "Food"
        assert Budget.objects.get(id=budget.id).name == "Food"

    def test_updates_monthly_amount(self):
        hh, user = _make_member_pair()
        budget = self._budget(hh, user)
        updated = update_budget(hh, user, budget, fields={"monthly_amount": Decimal("600")})
        assert updated.monthly_amount == Decimal("600.00")
        assert Budget.objects.get(id=budget.id).monthly_amount == Decimal("600.00")

    def test_updates_is_global(self):
        hh, user = _make_member_pair()
        budget = self._budget(hh, user)
        updated = update_budget(hh, user, budget, fields={"is_global": True})
        assert updated.is_global is True
        assert Budget.objects.get(id=budget.id).is_global is True

    def test_unknown_fields_are_ignored(self):
        hh, user = _make_member_pair()
        budget = self._budget(hh, user)
        # 'household' is not in the allowed set — should be silently ignored
        update_budget(hh, user, budget, fields={"household": None, "name": "New Name"})
        assert Budget.objects.get(id=budget.id).name == "New Name"

    def test_duplicate_name_on_update_raises(self):
        hh, user = _make_member_pair()
        create_budget(hh, user, name="Existing", monthly_amount=Decimal("200"))
        budget = self._budget(hh, user)
        with pytest.raises(ValidationError) as exc_info:
            update_budget(hh, user, budget, fields={"name": "Existing"})
        assert "name" in exc_info.value.detail

    def test_zero_amount_on_update_raises(self):
        hh, user = _make_member_pair()
        budget = self._budget(hh, user)
        with pytest.raises(ValidationError) as exc_info:
            update_budget(hh, user, budget, fields={"monthly_amount": Decimal("0")})
        assert "monthly_amount" in exc_info.value.detail


# ---------------------------------------------------------------------------
# delete_budget service
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeleteBudget:
    """delete_budget() — hard delete, household guard, expenses become unbudgeted."""

    def test_deletes_budget(self):
        hh, user = _make_member_pair()
        budget = create_budget(hh, user, name="Groceries", monthly_amount=Decimal("400"))
        budget_id = budget.id
        delete_budget(hh, user, budget)
        assert not Budget.objects.filter(id=budget_id).exists()

    def test_cross_household_raises(self):
        hh1, user1 = _make_member_pair()
        hh2, user2 = _make_member_pair()
        budget = create_budget(hh1, user1, name="Groceries", monthly_amount=Decimal("400"))
        with pytest.raises(ValueError):
            delete_budget(hh2, user2, budget)
        # Budget must still exist
        assert Budget.objects.filter(id=budget.id).exists()

    def test_deleting_budget_sets_interaction_budget_to_null(self):
        """Expenses must NOT be deleted when their budget is removed (SET_NULL)."""
        hh, user = _make_member_pair()
        budget = create_budget(hh, user, name="Groceries", monthly_amount=Decimal("400"))
        interaction = create_manual_expense_interaction(
            household=hh,
            user=user,
            subject="Supermarket",
            amount=Decimal("75.00"),
            budget_id=budget.id,
        )
        assert interaction.budget_id == budget.id

        delete_budget(hh, user, budget)

        from interactions.models import Interaction
        refreshed = Interaction.objects.get(id=interaction.id)
        assert refreshed.budget_id is None  # SET_NULL, not cascade
