# budget/tests/test_agent_recurring.py
"""
Agent writables registry tests for the recurring_expense entity (parcours 21 lot 2).

Covers:
  1. TestRecurringWritableSpec   — spec is registered, create/delete/LookupError contract
  2. TestRecurringPingSpec       — PingSpec 'recurring_due' build_message returns a string
                                   listing due recurrences and None when nothing is due
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from budget.models import RecurringExpense
from budget.services import create_recurring_expense
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


def _create_rec(hh, user, **kwargs):
    defaults = dict(
        label="Netflix",
        amount=Decimal("12.99"),
        cadence="monthly",
        next_due_date=date(2026, 8, 1),
    )
    defaults.update(kwargs)
    return create_recurring_expense(hh, user, **defaults)


# ===========================================================================
# 1. TestRecurringWritableSpec
# ===========================================================================


@pytest.mark.django_db
class TestRecurringWritableSpec:
    """WritableSpec for recurring_expense — registration + create/delete contract."""

    def test_spec_is_registered(self):
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        assert spec is not None
        assert spec.entity_type == "recurring_expense"
        assert spec.create is not None
        assert spec.delete is not None

    def test_agent_create_produces_recurring_expense(self):
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        hh = HouseholdFactory()
        user = _make_owner(hh)

        instance = spec.create(
            hh,
            user,
            {
                "label": "Agent Spotify",
                "amount": "9.99",
                "cadence": "monthly",
                "next_due_date": "2026-08-01",
            },
            anchor=None,
        )
        assert isinstance(instance, RecurringExpense)
        assert instance.label == "Agent Spotify"
        assert instance.amount == Decimal("9.99")
        assert instance.household == hh
        # DB state
        from_db = RecurringExpense.objects.get(id=instance.id)
        assert from_db.label == "Agent Spotify"
        assert from_db.household == hh

    def test_agent_create_equals_service_result(self):
        """spec.create delegates to create_recurring_expense — same validation."""
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        hh = HouseholdFactory()
        user = _make_owner(hh)

        # Agent path
        agent_instance = spec.create(
            hh,
            user,
            {"label": "Agent Bill", "amount": "30.00", "cadence": "quarterly",
             "next_due_date": "2026-10-01"},
            anchor=None,
        )
        # Service path
        service_instance = _create_rec(
            hh, user, label="Service Bill", amount=Decimal("30.00"),
            cadence="quarterly", next_due_date=date(2026, 10, 1),
        )
        # Both are scoped to the same household
        assert agent_instance.household == service_instance.household

    def test_agent_create_validates_zero_amount(self):
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        hh = HouseholdFactory()
        user = _make_owner(hh)

        with pytest.raises(ValidationError):
            spec.create(
                hh, user,
                {"label": "Free", "amount": "0", "cadence": "monthly",
                 "next_due_date": "2026-08-01"},
                anchor=None,
            )

    def test_agent_create_validates_blank_label(self):
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        hh = HouseholdFactory()
        user = _make_owner(hh)

        with pytest.raises(ValidationError):
            spec.create(
                hh, user,
                {"label": "   ", "amount": "10.00", "cadence": "monthly",
                 "next_due_date": "2026-08-01"},
                anchor=None,
            )

    def test_agent_delete_removes_recurring_expense(self):
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        hh = HouseholdFactory()
        user = _make_owner(hh)
        rec = _create_rec(hh, user)
        rec_id = rec.id

        spec.delete(hh, user, rec_id)
        assert not RecurringExpense.objects.filter(id=rec_id).exists()

    def test_agent_delete_idempotent_raises_lookup_error(self):
        """Double-undo: deleting a recurrence that no longer exists → LookupError."""
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        hh = HouseholdFactory()
        user = _make_owner(hh)
        rec = _create_rec(hh, user)
        rec_id = rec.id

        spec.delete(hh, user, rec_id)
        with pytest.raises(LookupError):
            spec.delete(hh, user, rec_id)

    def test_agent_delete_unknown_id_raises_lookup_error(self):
        import uuid
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        hh = HouseholdFactory()
        user = _make_owner(hh)
        fake_id = uuid.uuid4()

        with pytest.raises(LookupError):
            spec.delete(hh, user, fake_id)

    def test_agent_delete_cross_household_raises_lookup_error(self):
        """An id from another household resolves to None → LookupError."""
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        user_a = _make_owner(hh_a)
        user_b = _make_owner(hh_b)
        rec_a = _create_rec(hh_a, user_a)

        with pytest.raises(LookupError):
            spec.delete(hh_b, user_b, rec_a.id)

    def test_member_can_create_through_agent_path(self):
        """Any member (not only owner) may create via agent."""
        from agent.writables import find_spec

        spec = find_spec("recurring_expense")
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)

        instance = spec.create(
            hh, member,
            {"label": "Member Bill", "amount": "15.00", "cadence": "monthly",
             "next_due_date": "2026-08-01"},
            anchor=None,
        )
        assert isinstance(instance, RecurringExpense)
        assert instance.household == hh


# ===========================================================================
# 2. TestRecurringPingSpec
# ===========================================================================


@pytest.mark.django_db
class TestRecurringPingSpec:
    """PingSpec 'recurring_due' — build_message contract."""

    def _get_build_message(self):
        from pings.registry import find_spec
        spec = find_spec("recurring_due")
        assert spec is not None, "PingSpec 'recurring_due' is not registered"
        return spec.build_message

    def test_ping_spec_is_registered(self):
        from pings.registry import find_spec

        spec = find_spec("recurring_due")
        assert spec is not None
        assert spec.ping_type == "recurring_due"

    def test_returns_none_when_nothing_due(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        build_message = self._get_build_message()
        # No recurrences at all
        result = build_message(hh, user, today=date.today())
        assert result is None

    def test_returns_none_when_all_future(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        future = date.today() + timedelta(days=30)
        _create_rec(hh, user, label="Future Bill", next_due_date=future)
        build_message = self._get_build_message()
        result = build_message(hh, user, today=date.today())
        assert result is None

    def test_returns_string_when_due(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        _create_rec(hh, user, label="Netflix", next_due_date=date.today())
        build_message = self._get_build_message()
        result = build_message(hh, user, today=date.today())
        assert result is not None
        assert isinstance(result, str)
        assert len(result) > 0

    def test_message_contains_due_label(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        _create_rec(hh, user, label="Insurance 2026", next_due_date=date.today())
        build_message = self._get_build_message()
        result = build_message(hh, user, today=date.today())
        assert result is not None
        assert "Insurance 2026" in result

    def test_message_contains_amount(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        _create_rec(hh, user, label="SFR", amount=Decimal("29.99"), next_due_date=date.today())
        build_message = self._get_build_message()
        result = build_message(hh, user, today=date.today())
        assert result is not None
        assert "29.99" in result

    def test_multiple_due_listed(self):
        hh = HouseholdFactory()
        user = _make_owner(hh)
        _create_rec(hh, user, label="Bill A", next_due_date=date.today())
        _create_rec(hh, user, label="Bill B", next_due_date=date.today())
        build_message = self._get_build_message()
        result = build_message(hh, user, today=date.today())
        assert result is not None
        assert "Bill A" in result
        assert "Bill B" in result

    def test_cross_household_not_in_message(self):
        """build_message must only list recurrences for the given household."""
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        user_a = _make_owner(hh_a)
        user_b = _make_owner(hh_b)
        _create_rec(hh_b, user_b, label="HouseholdB Secret", next_due_date=date.today())
        build_message = self._get_build_message()
        result = build_message(hh_a, user_a, today=date.today())
        # No recurrences in hh_a → None
        assert result is None
