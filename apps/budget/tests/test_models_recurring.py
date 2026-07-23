# budget/tests/test_models_recurring.py
"""
Model + service layer tests for RecurringExpense (parcours 21 lot 2).

Covers:
  1. TestAdvanceDueDate       — advance_due_date() month arithmetic + clamping
  2. TestCreateRecurring      — create_recurring_expense() happy-path + validation
  3. TestUpdateRecurring      — update_recurring_expense() field edits + budget_id re-resolve
  4. TestDeleteRecurring      — delete_recurring_expense() hard delete + household guard
  5. TestConfirmOccurrence    — confirm_recurring_occurrence() interaction creation,
                                budget attachment, next_due_date advance, amount override,
                                cross-household guard, effect on budget overview
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from budget.models import RecurringExpense
from budget.services import (
    advance_due_date,
    confirm_recurring_occurrence,
    create_recurring_expense,
    delete_recurring_expense,
    update_recurring_expense,
)
from budget.services import create_budget
from households.models import HouseholdMember
from interactions.models import Interaction

from .factories import (
    HouseholdFactory,
    HouseholdMemberFactory,
    RecurringExpenseFactory,
    UserFactory,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    return user


def _make_pair():
    """Return (household, owner_user)."""
    hh = HouseholdFactory()
    return hh, _make_owner(hh)


def _create_rec(hh, user, **kwargs):
    defaults = dict(
        label="Netflix",
        amount=Decimal("12.99"),
        cadence="monthly",
        next_due_date=date(2026, 7, 1),
    )
    defaults.update(kwargs)
    return create_recurring_expense(hh, user, **defaults)


# ===========================================================================
# 1. TestAdvanceDueDate
# ===========================================================================


@pytest.mark.django_db
class TestAdvanceDueDate:
    """advance_due_date() — month arithmetic with end-of-month clamping."""

    def test_monthly_normal_day(self):
        assert advance_due_date(date(2026, 3, 15), "monthly") == date(2026, 4, 15)

    def test_monthly_jan_31_clamps_to_feb_28(self):
        # Jan 31 +1 month → Feb 28 (non-leap year)
        assert advance_due_date(date(2026, 1, 31), "monthly") == date(2026, 2, 28)

    def test_monthly_jan_31_clamps_to_feb_29_on_leap_year(self):
        # 2028 is a leap year
        assert advance_due_date(date(2028, 1, 31), "monthly") == date(2028, 2, 29)

    def test_monthly_dec_advances_to_next_year_jan(self):
        assert advance_due_date(date(2026, 12, 15), "monthly") == date(2027, 1, 15)

    def test_monthly_dec_31_to_jan_31(self):
        assert advance_due_date(date(2026, 12, 31), "monthly") == date(2027, 1, 31)

    def test_quarterly_normal(self):
        assert advance_due_date(date(2026, 3, 15), "quarterly") == date(2026, 6, 15)

    def test_quarterly_nov_30_clamps_to_feb_28(self):
        # Nov 30 +3 months → Feb 28 (2027, non-leap)
        assert advance_due_date(date(2026, 11, 30), "quarterly") == date(2027, 2, 28)

    def test_quarterly_crosses_year_boundary(self):
        assert advance_due_date(date(2026, 10, 1), "quarterly") == date(2027, 1, 1)

    def test_yearly_normal(self):
        assert advance_due_date(date(2026, 3, 15), "yearly") == date(2027, 3, 15)

    def test_yearly_leap_day_clamps(self):
        # Feb 29 on leap year → Feb 28 next year (non-leap)
        assert advance_due_date(date(2024, 2, 29), "yearly") == date(2025, 2, 28)

    def test_unknown_cadence_raises_value_error(self):
        with pytest.raises(ValueError, match="unknown cadence"):
            advance_due_date(date(2026, 1, 1), "biweekly")

    def test_empty_cadence_raises_value_error(self):
        with pytest.raises(ValueError):
            advance_due_date(date(2026, 1, 1), "")


# ===========================================================================
# 2. TestCreateRecurring
# ===========================================================================


@pytest.mark.django_db
class TestCreateRecurring:
    """create_recurring_expense() — happy path, validation, budget_id resolution."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_creates_recurring_expense(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, label="Spotify", amount=Decimal("9.99"))
        assert rec.id is not None
        assert rec.label == "Spotify"
        assert rec.amount == Decimal("9.99")
        assert rec.household == hh
        # DB state
        from_db = RecurringExpense.objects.get(id=rec.id)
        assert from_db.label == "Spotify"
        assert from_db.household == hh

    def test_all_cadences_accepted(self):
        hh, user = _make_pair()
        for cadence in ("monthly", "quarterly", "yearly"):
            rec = self._create_rec(hh, user, label=f"Bill {cadence}", cadence=cadence)
            assert rec.cadence == cadence

    def test_created_by_is_set(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        assert RecurringExpense.objects.get(id=rec.id).created_by == user

    def test_optional_fields_default_to_empty(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        assert rec.supplier == ""
        assert rec.notes == ""
        assert rec.budget is None

    def test_positive_amount_required_zero_raises(self):
        hh, user = _make_pair()
        with pytest.raises(ValidationError) as exc_info:
            self._create_rec(hh, user, amount=Decimal("0"))
        assert "amount" in exc_info.value.detail

    def test_negative_amount_raises(self):
        hh, user = _make_pair()
        with pytest.raises(ValidationError) as exc_info:
            self._create_rec(hh, user, amount=Decimal("-5"))
        assert "amount" in exc_info.value.detail

    def test_blank_label_raises(self):
        hh, user = _make_pair()
        with pytest.raises(ValidationError) as exc_info:
            self._create_rec(hh, user, label="   ")
        assert "label" in exc_info.value.detail

    def test_empty_label_raises(self):
        hh, user = _make_pair()
        with pytest.raises(ValidationError) as exc_info:
            self._create_rec(hh, user, label="")
        assert "label" in exc_info.value.detail

    def test_budget_id_attaches_named_budget(self):
        hh, user = _make_pair()
        budget = create_budget(hh, user, name="Housing", monthly_amount=Decimal("1000"))
        rec = self._create_rec(hh, user, budget_id=str(budget.id))
        assert RecurringExpense.objects.get(id=rec.id).budget_id == budget.id

    def test_global_budget_id_raises(self):
        hh, user = _make_pair()
        global_budget = create_budget(
            hh, user, name="Global Cap", monthly_amount=Decimal("3000"), is_global=True
        )
        with pytest.raises(ValidationError) as exc_info:
            self._create_rec(hh, user, budget_id=str(global_budget.id))
        assert "budget_id" in exc_info.value.detail

    def test_foreign_household_budget_id_raises(self):
        hh_a, user_a = _make_pair()
        hh_b, user_b = _make_pair()
        budget_b = create_budget(hh_b, user_b, name="Housing", monthly_amount=Decimal("800"))
        with pytest.raises(ValidationError) as exc_info:
            self._create_rec(hh_a, user_a, budget_id=str(budget_b.id))
        assert "budget_id" in exc_info.value.detail


# ===========================================================================
# 3. TestUpdateRecurring
# ===========================================================================


@pytest.mark.django_db
class TestUpdateRecurring:
    """update_recurring_expense() — editable fields, budget_id re-resolution, null detach."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_updates_label(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, label="Old Label")
        updated = update_recurring_expense(hh, user, rec, fields={"label": "New Label"})
        assert updated.label == "New Label"
        assert RecurringExpense.objects.get(id=rec.id).label == "New Label"

    def test_updates_amount(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, amount=Decimal("10.00"))
        updated = update_recurring_expense(hh, user, rec, fields={"amount": Decimal("20.00")})
        assert RecurringExpense.objects.get(id=rec.id).amount == Decimal("20.00")

    def test_updates_cadence(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, cadence="monthly")
        update_recurring_expense(hh, user, rec, fields={"cadence": "quarterly"})
        assert RecurringExpense.objects.get(id=rec.id).cadence == "quarterly"

    def test_updates_next_due_date(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, next_due_date=date(2026, 7, 1))
        new_date = date(2026, 8, 1)
        update_recurring_expense(hh, user, rec, fields={"next_due_date": new_date})
        assert RecurringExpense.objects.get(id=rec.id).next_due_date == new_date

    def test_updates_supplier_and_notes(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        update_recurring_expense(
            hh, user, rec, fields={"supplier": "Acme", "notes": "Auto-pay"}
        )
        from_db = RecurringExpense.objects.get(id=rec.id)
        assert from_db.supplier == "Acme"
        assert from_db.notes == "Auto-pay"

    def test_unknown_fields_ignored(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, label="Keep Me")
        update_recurring_expense(hh, user, rec, fields={"household": None, "label": "Keep Me"})
        assert RecurringExpense.objects.get(id=rec.id).label == "Keep Me"

    def test_budget_id_re_resolution_attaches_budget(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        budget = create_budget(hh, user, name="Housing", monthly_amount=Decimal("1000"))
        update_recurring_expense(hh, user, rec, fields={"budget_id": str(budget.id)})
        assert RecurringExpense.objects.get(id=rec.id).budget_id == budget.id

    def test_budget_id_null_detaches_budget(self):
        hh, user = _make_pair()
        budget = create_budget(hh, user, name="Housing", monthly_amount=Decimal("1000"))
        rec = self._create_rec(hh, user, budget_id=str(budget.id))
        assert rec.budget_id == budget.id
        update_recurring_expense(hh, user, rec, fields={"budget_id": None})
        assert RecurringExpense.objects.get(id=rec.id).budget_id is None

    def test_zero_amount_on_update_raises(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        with pytest.raises(ValidationError) as exc_info:
            update_recurring_expense(hh, user, rec, fields={"amount": Decimal("0")})
        assert "amount" in exc_info.value.detail

    def test_blank_label_on_update_raises(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        with pytest.raises(ValidationError) as exc_info:
            update_recurring_expense(hh, user, rec, fields={"label": "   "})
        assert "label" in exc_info.value.detail


# ===========================================================================
# 4. TestDeleteRecurring
# ===========================================================================


@pytest.mark.django_db
class TestDeleteRecurring:
    """delete_recurring_expense() — hard delete + household guard."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_deletes_recurring_expense(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        rec_id = rec.id
        delete_recurring_expense(hh, user, rec)
        assert not RecurringExpense.objects.filter(id=rec_id).exists()

    def test_cross_household_raises_value_error(self):
        hh_a, user_a = _make_pair()
        hh_b, user_b = _make_pair()
        rec = self._create_rec(hh_a, user_a)
        with pytest.raises(ValueError, match="another household"):
            delete_recurring_expense(hh_b, user_b, rec)
        # Must still exist
        assert RecurringExpense.objects.filter(id=rec.id).exists()

    def test_confirmed_interactions_not_deleted(self):
        """Confirming then deleting the schedule must leave the Interaction intact."""
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        interaction, _ = confirm_recurring_occurrence(hh, user, rec)
        interaction_id = interaction.id
        # Re-fetch (confirm advanced next_due_date on the same instance)
        rec_fresh = RecurringExpense.objects.get(id=rec.id)
        delete_recurring_expense(hh, user, rec_fresh)
        assert Interaction.objects.filter(id=interaction_id).exists()


# ===========================================================================
# 5. TestConfirmOccurrence
# ===========================================================================


@pytest.mark.django_db
class TestConfirmOccurrence:
    """confirm_recurring_occurrence() — all acceptance criteria from the spec."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_creates_interaction_type_expense(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, label="Rent")
        interaction, _ = confirm_recurring_occurrence(hh, user, rec)
        from_db = Interaction.objects.get(id=interaction.id)
        assert from_db.type == "expense"

    def test_interaction_subject_matches_label(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, label="Electricity Bill")
        interaction, _ = confirm_recurring_occurrence(hh, user, rec)
        assert Interaction.objects.get(id=interaction.id).subject == "Electricity Bill"

    def test_metadata_kind_is_recurring(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        interaction, _ = confirm_recurring_occurrence(hh, user, rec)
        from_db = Interaction.objects.get(id=interaction.id)
        assert from_db.metadata["kind"] == "recurring"

    def test_metadata_recurring_id_matches(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        interaction, _ = confirm_recurring_occurrence(hh, user, rec)
        from_db = Interaction.objects.get(id=interaction.id)
        assert from_db.metadata["recurring_id"] == str(rec.id)

    def test_next_due_date_advances_by_cadence(self):
        hh, user = _make_pair()
        original_due = date(2026, 7, 15)
        rec = self._create_rec(hh, user, cadence="monthly", next_due_date=original_due)
        _, updated_rec = confirm_recurring_occurrence(hh, user, rec)
        from_db = RecurringExpense.objects.get(id=rec.id)
        assert from_db.next_due_date == date(2026, 8, 15)
        assert updated_rec.next_due_date == from_db.next_due_date

    def test_quarterly_cadence_advances_by_three_months(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, cadence="quarterly", next_due_date=date(2026, 4, 1))
        confirm_recurring_occurrence(hh, user, rec)
        assert RecurringExpense.objects.get(id=rec.id).next_due_date == date(2026, 7, 1)

    def test_amount_override_applies_to_interaction(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, amount=Decimal("50.00"))
        interaction, _ = confirm_recurring_occurrence(hh, user, rec, amount=Decimal("65.00"))
        from_db = Interaction.objects.get(id=interaction.id)
        assert Decimal(from_db.metadata["amount"]) == Decimal("65.00")

    def test_no_amount_override_uses_recurring_amount(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user, amount=Decimal("29.99"))
        interaction, _ = confirm_recurring_occurrence(hh, user, rec)
        from_db = Interaction.objects.get(id=interaction.id)
        assert Decimal(from_db.metadata["amount"]) == Decimal("29.99")

    def test_interaction_attached_to_budget(self):
        hh, user = _make_pair()
        budget = create_budget(hh, user, name="Housing", monthly_amount=Decimal("1000"))
        rec = self._create_rec(hh, user, budget_id=str(budget.id))
        interaction, _ = confirm_recurring_occurrence(hh, user, rec)
        from_db = Interaction.objects.get(id=interaction.id)
        assert from_db.budget_id == budget.id

    def test_confirm_contributes_to_budget_spent(self):
        """After confirm, the interaction's amount appears in budget spent aggregation."""
        from budget.aggregations import compute_budget_overview

        hh, user = _make_pair()
        budget = create_budget(hh, user, name="Housing", monthly_amount=Decimal("1000"))
        rec = self._create_rec(
            hh, user, amount=Decimal("500.00"), budget_id=str(budget.id),
            next_due_date=date.today()
        )
        # Before confirm: spent = 0
        overview_before = compute_budget_overview(household=hh)
        row_before = next(b for b in overview_before["budgets"] if b["id"] == str(budget.id))
        assert Decimal(row_before["spent"]) == Decimal("0.00")

        confirm_recurring_occurrence(hh, user, rec)

        overview_after = compute_budget_overview(household=hh)
        row_after = next(b for b in overview_after["budgets"] if b["id"] == str(budget.id))
        assert Decimal(row_after["spent"]) == Decimal("500.00")

    def test_confirm_drops_committed(self):
        """Confirming a due recurrence advances next_due_date out of the month —
        so the recurrence no longer appears in the 'committed' bucket."""
        from budget.aggregations import compute_budget_overview

        hh, user = _make_pair()
        budget = create_budget(hh, user, name="Housing", monthly_amount=Decimal("1000"))
        # Place the due date within the current month
        today = date.today()
        rec = self._create_rec(
            hh, user, amount=Decimal("300.00"), cadence="monthly",
            budget_id=str(budget.id), next_due_date=today,
        )

        overview_before = compute_budget_overview(household=hh)
        row_before = next(b for b in overview_before["budgets"] if b["id"] == str(budget.id))
        # committed should be 300 before confirmation
        assert Decimal(row_before["committed"]) == Decimal("300.00")

        confirm_recurring_occurrence(hh, user, rec)

        overview_after = compute_budget_overview(household=hh)
        row_after = next(b for b in overview_after["budgets"] if b["id"] == str(budget.id))
        # After advancing, the next_due_date is next month → committed drops to 0
        assert Decimal(row_after["committed"]) == Decimal("0.00")

    def test_returns_tuple_interaction_and_recurring(self):
        hh, user = _make_pair()
        rec = self._create_rec(hh, user)
        result = confirm_recurring_occurrence(hh, user, rec)
        assert len(result) == 2
        interaction, recurring = result
        assert isinstance(interaction, Interaction)
        assert isinstance(recurring, RecurringExpense)

    def test_cross_household_raises_value_error(self):
        hh_a, user_a = _make_pair()
        hh_b, user_b = _make_pair()
        rec = self._create_rec(hh_a, user_a)
        with pytest.raises(ValueError, match="another household"):
            confirm_recurring_occurrence(hh_b, user_b, rec)
        # next_due_date must NOT have advanced
        assert RecurringExpense.objects.get(id=rec.id).next_due_date == rec.next_due_date
