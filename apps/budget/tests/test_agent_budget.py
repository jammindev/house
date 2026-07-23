# budget/tests/test_agent_budget.py
"""
Agent writables registry tests for the budget entity.

Covers:
  - WritableSpec is registered under entity_type='budget'
  - create via the agent path (spec.create) produces same result as REST (both go through create_budget)
  - delete via agent path (spec.delete) hard-deletes the budget
  - double-delete raises LookupError (idempotent undo contract)
  - Non-owner member can create/delete through the agent path (Lot 1 decision)

NOTE: we do NOT clear the registry between tests — the budget app is loaded via
Django app ready() and the spec is already there.  We just call find_spec and
exercise the registered callables directly.
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from budget.models import Budget
from budget.services import create_budget
from households.models import HouseholdMember

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


def _make_member(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


# ---------------------------------------------------------------------------
# WritableSpec registration
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestBudgetWritableSpec:
    """Asserts the budget WritableSpec is registered and wired correctly."""

    def test_spec_is_registered(self):
        from agent.writables import find_spec

        spec = find_spec("budget")
        assert spec is not None
        assert spec.entity_type == "budget"
        assert spec.create is not None
        assert spec.delete is not None

    def test_agent_create_produces_same_result_as_rest_service(self):
        """
        The anti-duplication contract: spec.create delegates to
        budget.services.create_budget — same validation, same household scope.
        """
        from agent.writables import find_spec

        spec = find_spec("budget")
        hh = HouseholdFactory()
        user = _make_owner(hh)

        instance = spec.create(
            hh,
            user,
            {"name": "Agent Budget", "monthly_amount": "300"},
            anchor=None,
        )
        assert isinstance(instance, Budget)
        assert instance.name == "Agent Budget"
        assert instance.monthly_amount == Decimal("300.00")
        assert instance.household == hh
        # DB state
        from_db = Budget.objects.get(id=instance.id)
        assert from_db.name == "Agent Budget"
        assert from_db.household == hh

    def test_agent_create_validates_positive_amount(self):
        """spec.create must raise ValidationError on zero amount (same as service)."""
        from agent.writables import find_spec
        from rest_framework.exceptions import ValidationError

        spec = find_spec("budget")
        hh = HouseholdFactory()
        user = _make_owner(hh)

        with pytest.raises(ValidationError):
            spec.create(hh, user, {"name": "Free", "monthly_amount": "0"}, anchor=None)

    def test_agent_create_validates_blank_name(self):
        from agent.writables import find_spec
        from rest_framework.exceptions import ValidationError

        spec = find_spec("budget")
        hh = HouseholdFactory()
        user = _make_owner(hh)

        with pytest.raises(ValidationError):
            spec.create(hh, user, {"name": "   ", "monthly_amount": "200"}, anchor=None)

    def test_agent_create_second_global_raises(self):
        from agent.writables import find_spec
        from rest_framework.exceptions import ValidationError

        spec = find_spec("budget")
        hh = HouseholdFactory()
        user = _make_owner(hh)
        create_budget(hh, user, name="First Global", monthly_amount=Decimal("2000"), is_global=True)

        with pytest.raises(ValidationError):
            spec.create(
                hh, user, {"name": "Second Global", "monthly_amount": "1000", "is_global": True}, anchor=None
            )

    def test_agent_delete_removes_budget(self):
        from agent.writables import find_spec

        spec = find_spec("budget")
        hh = HouseholdFactory()
        user = _make_owner(hh)
        budget = create_budget(hh, user, name="To Delete", monthly_amount=Decimal("100"))
        budget_id = budget.id

        spec.delete(hh, user, budget_id)
        assert not Budget.objects.filter(id=budget_id).exists()

    def test_agent_delete_idempotent_raises_lookup_error(self):
        """Double-undo: deleting a budget that no longer exists → LookupError."""
        from agent.writables import find_spec

        spec = find_spec("budget")
        hh = HouseholdFactory()
        user = _make_owner(hh)
        budget = create_budget(hh, user, name="To Delete", monthly_amount=Decimal("100"))
        budget_id = budget.id

        spec.delete(hh, user, budget_id)
        # Second delete must raise LookupError, not crash with an exception
        with pytest.raises(LookupError):
            spec.delete(hh, user, budget_id)

    def test_agent_delete_unknown_id_raises_lookup_error(self):
        import uuid
        from agent.writables import find_spec

        spec = find_spec("budget")
        hh = HouseholdFactory()
        user = _make_owner(hh)
        fake_id = uuid.uuid4()

        with pytest.raises(LookupError):
            spec.delete(hh, user, fake_id)

    def test_agent_delete_cross_household_raises_lookup_error(self):
        """An id from another household resolves to None → LookupError."""
        import uuid
        from agent.writables import find_spec

        spec = find_spec("budget")
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        user_a = _make_owner(hh_a)
        user_b = _make_owner(hh_b)
        budget_a = create_budget(hh_a, user_a, name="Private", monthly_amount=Decimal("100"))

        # household_b should not be able to delete household_a's budget
        with pytest.raises(LookupError):
            spec.delete(hh_b, user_b, budget_a.id)

    def test_member_can_create_through_agent_path(self):
        """Lot 1 decision: any member (not only owner) may create via agent."""
        from agent.writables import find_spec

        spec = find_spec("budget")
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)

        instance = spec.create(
            hh, member, {"name": "Member Created", "monthly_amount": "250"}, anchor=None
        )
        assert isinstance(instance, Budget)
        assert instance.household == hh

    def test_agent_and_rest_use_same_service(self):
        """
        Create the same budget twice — once via service (REST path), once via spec
        (agent path). Both should succeed independently (different names) and both
        should be stored in the DB scoped to the same household.
        """
        from agent.writables import find_spec

        spec = find_spec("budget")
        hh = HouseholdFactory()
        user = _make_owner(hh)

        rest_budget = create_budget(hh, user, name="REST Budget", monthly_amount=Decimal("400"))
        agent_budget = spec.create(
            hh, user, {"name": "Agent Budget", "monthly_amount": "400"}, anchor=None
        )

        assert Budget.objects.filter(household=hh).count() == 2
        assert Budget.objects.get(id=rest_budget.id).household == hh
        assert Budget.objects.get(id=agent_budget.id).household == hh
