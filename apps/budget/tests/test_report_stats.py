# budget/tests/test_report_stats.py
"""
Unit tests for budget.report.stats.

Coverage:
  1. TestMonthBounds        — tz-aware boundary computation
  2. TestPreviousMonth      — month arithmetic edge cases (Jan → Dec, mid-year)
  3. TestComputeMonthStats  — aggregation correctness, month isolation, trend,
                             per-budget, unbudgeted, recurring, top-expenses,
                             global budget row, expense_count
"""
from __future__ import annotations

from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from budget.models import Budget
from budget.report.stats import compute_month_stats, month_bounds, previous_month
from budget.services import create_budget
from households.models import HouseholdMember
from interactions.services import create_manual_expense_interaction

from .factories import (
    BudgetFactory,
    HouseholdFactory,
    HouseholdMemberFactory,
    UserFactory,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _make_expense(household, user, amount, *, month, budget=None, kind="manual"):
    """Create an expense interaction in the given month (day 15)."""
    from datetime import datetime

    tz = ZoneInfo(getattr(household, "timezone", None) or "UTC")
    year, mon = (int(p) for p in month.split("-"))
    occurred_at = datetime(year, mon, 15, 12, 0, 0, tzinfo=tz)
    return create_manual_expense_interaction(
        household=household,
        user=user,
        subject=f"Expense {amount} {kind}",
        amount=Decimal(str(amount)),
        occurred_at=occurred_at,
        budget_id=budget.id if budget else None,
    )


def _make_recurring_expense(household, user, amount, *, month):
    """Create an expense tagged metadata.kind='recurring' for the given month."""
    from datetime import datetime

    from interactions.models import Interaction

    tz = ZoneInfo(getattr(household, "timezone", None) or "UTC")
    year, mon = (int(p) for p in month.split("-"))
    occurred_at = datetime(year, mon, 15, 12, 0, 0, tzinfo=tz)
    # create_manual_expense_interaction always sets kind='manual'; we patch after
    interaction = create_manual_expense_interaction(
        household=household,
        user=user,
        subject=f"Recurring {amount}",
        amount=Decimal(str(amount)),
        occurred_at=occurred_at,
    )
    # Override kind to 'recurring' to exercise the recurring filter
    meta = dict(interaction.metadata)
    meta["kind"] = "recurring"
    interaction.metadata = meta
    interaction.save(update_fields=["metadata"])
    return interaction


# ===========================================================================
# 1. TestMonthBounds
# ===========================================================================


@pytest.mark.django_db
class TestMonthBounds:
    """month_bounds returns tz-aware start + exclusive end in household timezone."""

    def test_start_is_first_day_midnight(self):
        hh = HouseholdFactory()
        start, end = month_bounds(hh, "2026-06")
        assert start.year == 2026
        assert start.month == 6
        assert start.day == 1
        assert start.hour == 0
        assert start.minute == 0

    def test_end_is_exclusive_first_of_next_month(self):
        hh = HouseholdFactory()
        start, end = month_bounds(hh, "2026-06")
        assert end.year == 2026
        assert end.month == 7
        assert end.day == 1

    def test_december_end_rolls_to_january_next_year(self):
        hh = HouseholdFactory()
        _, end = month_bounds(hh, "2025-12")
        assert end.year == 2026
        assert end.month == 1
        assert end.day == 1

    def test_bounds_are_timezone_aware(self):
        hh = HouseholdFactory()
        start, end = month_bounds(hh, "2026-03")
        assert start.tzinfo is not None
        assert end.tzinfo is not None

    def test_household_utc_fallback(self):
        """A household with an empty timezone string falls back to UTC."""
        hh = HouseholdFactory()
        hh.timezone = ""  # blank → UTC fallback (column is NOT NULL, default='')
        hh.save()
        start, end = month_bounds(hh, "2026-01")
        assert str(start.tzinfo) == "UTC"


# ===========================================================================
# 2. TestPreviousMonth
# ===========================================================================


@pytest.mark.django_db
class TestPreviousMonth:
    """previous_month correctly crosses year boundaries and mid-year transitions."""

    def test_january_becomes_december_previous_year(self):
        assert previous_month("2026-01") == "2025-12"

    def test_mid_year_decrements_month(self):
        assert previous_month("2026-07") == "2026-06"

    def test_february_becomes_january(self):
        assert previous_month("2026-02") == "2026-01"

    def test_december_becomes_november(self):
        assert previous_month("2026-12") == "2026-11"

    def test_output_zero_pads_month(self):
        result = previous_month("2026-10")
        assert result == "2026-09"  # single-digit month is zero-padded


# ===========================================================================
# 3. TestComputeMonthStats
# ===========================================================================


@pytest.mark.django_db
class TestComputeMonthStats:
    """compute_month_stats returns the correct numeric snapshot for a closed month."""

    # --- helpers ---

    def _create_budget(self, household, user, **kwargs):
        defaults = {"name": "Groceries", "monthly_amount": Decimal("500")}
        defaults.update(kwargs)
        return create_budget(household, user, **defaults)

    # --- shape ---

    def test_returns_all_required_keys(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        stats = compute_month_stats(hh, "2026-06")
        required_keys = {
            "month", "total_spent", "prev_month", "prev_total",
            "trend_delta", "trend_pct", "budgets", "unbudgeted",
            "top_expenses", "recurring", "global", "expense_count",
        }
        assert required_keys <= set(stats.keys())

    def test_empty_month_returns_zeros(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        stats = compute_month_stats(hh, "2026-06")
        assert Decimal(stats["total_spent"]) == Decimal("0.00")
        assert Decimal(stats["unbudgeted"]) == Decimal("0.00")
        assert stats["expense_count"] == 0
        assert stats["top_expenses"] == []
        assert stats["recurring"]["count"] == 0
        assert Decimal(stats["recurring"]["total"]) == Decimal("0.00")

    # --- month isolation ---

    def test_only_expenses_of_target_month_counted(self):
        """Expenses in adjacent months (prev and next) must not appear in the stats."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)

        _make_expense(hh, owner, "50.00", month="2026-05")   # previous month
        _make_expense(hh, owner, "100.00", month="2026-06")  # target month
        _make_expense(hh, owner, "75.00", month="2026-07")   # next month

        stats = compute_month_stats(hh, "2026-06")
        assert Decimal(stats["total_spent"]) == Decimal("100.00")
        assert stats["expense_count"] == 1

    # --- total_spent aggregation ---

    def test_total_spent_sums_all_expenses_in_month(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-06")
        _make_expense(hh, owner, "200.50", month="2026-06")
        stats = compute_month_stats(hh, "2026-06")
        assert Decimal(stats["total_spent"]) == Decimal("300.50")

    # --- per-budget spent ---

    def test_per_budget_spent_correctly_attributed(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Food", monthly_amount=Decimal("400"))
        _make_expense(hh, owner, "80.00", month="2026-06", budget=budget)
        _make_expense(hh, owner, "120.00", month="2026-06", budget=budget)

        stats = compute_month_stats(hh, "2026-06")
        assert len(stats["budgets"]) == 1
        row = stats["budgets"][0]
        assert row["name"] == "Food"
        assert Decimal(row["spent"]) == Decimal("200.00")
        assert Decimal(row["amount"]) == Decimal("400.00")

    def test_budget_state_ok_below_80_percent(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Transport", monthly_amount=Decimal("100"))
        _make_expense(hh, owner, "70.00", month="2026-06", budget=budget)
        stats = compute_month_stats(hh, "2026-06")
        assert stats["budgets"][0]["state"] == "ok"

    def test_budget_state_warning_at_80_percent(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Transport", monthly_amount=Decimal("100"))
        _make_expense(hh, owner, "80.00", month="2026-06", budget=budget)
        stats = compute_month_stats(hh, "2026-06")
        assert stats["budgets"][0]["state"] == "warning"

    def test_budget_state_over_at_100_percent(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Transport", monthly_amount=Decimal("100"))
        _make_expense(hh, owner, "150.00", month="2026-06", budget=budget)
        stats = compute_month_stats(hh, "2026-06")
        assert stats["budgets"][0]["state"] == "over"

    # --- unbudgeted ---

    def test_unbudgeted_captures_expenses_without_budget(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Food", monthly_amount=Decimal("400"))
        _make_expense(hh, owner, "55.00", month="2026-06", budget=None)
        stats = compute_month_stats(hh, "2026-06")
        assert Decimal(stats["unbudgeted"]) == Decimal("55.00")

    def test_budgeted_expenses_do_not_appear_in_unbudgeted(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Food", monthly_amount=Decimal("400"))
        _make_expense(hh, owner, "100.00", month="2026-06", budget=budget)
        stats = compute_month_stats(hh, "2026-06")
        assert Decimal(stats["unbudgeted"]) == Decimal("0.00")

    # --- global budget row ---

    def test_global_budget_row_present_when_exists(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Total Cap", monthly_amount=Decimal("2000"), is_global=True)
        _make_expense(hh, owner, "300.00", month="2026-06")
        stats = compute_month_stats(hh, "2026-06")
        assert stats["global"] is not None
        assert stats["global"]["name"] == "Total Cap"
        assert Decimal(stats["global"]["spent"]) == Decimal("300.00")

    def test_global_budget_spent_equals_total_spent(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = self._create_budget(hh, owner, name="Food", monthly_amount=Decimal("400"))
        self._create_budget(hh, owner, name="Total Cap", monthly_amount=Decimal("2000"), is_global=True)
        _make_expense(hh, owner, "100.00", month="2026-06", budget=budget)
        _make_expense(hh, owner, "50.00", month="2026-06", budget=None)
        stats = compute_month_stats(hh, "2026-06")
        assert Decimal(stats["global"]["spent"]) == Decimal("150.00")
        assert Decimal(stats["total_spent"]) == Decimal("150.00")

    def test_global_row_is_none_when_no_global_budget(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Food", monthly_amount=Decimal("400"))
        stats = compute_month_stats(hh, "2026-06")
        assert stats["global"] is None

    # --- global budget not in budgets list ---

    def test_global_budget_excluded_from_budgets_list(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_budget(hh, owner, name="Food", monthly_amount=Decimal("400"))
        self._create_budget(hh, owner, name="Cap", monthly_amount=Decimal("2000"), is_global=True)
        stats = compute_month_stats(hh, "2026-06")
        names = [b["name"] for b in stats["budgets"]]
        assert "Cap" not in names
        assert "Food" in names

    # --- top_expenses ---

    def test_top_expenses_ordered_by_amount_descending(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        for amount in ["50", "300", "10", "150", "75"]:
            _make_expense(hh, owner, amount, month="2026-06")
        stats = compute_month_stats(hh, "2026-06")
        amounts = [Decimal(e["amount"]) for e in stats["top_expenses"]]
        assert amounts == sorted(amounts, reverse=True)

    def test_top_expenses_capped_at_five(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        for i in range(8):
            _make_expense(hh, owner, str(10 * (i + 1)), month="2026-06")
        stats = compute_month_stats(hh, "2026-06")
        assert len(stats["top_expenses"]) == 5

    def test_top_expenses_includes_subject(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-06")
        stats = compute_month_stats(hh, "2026-06")
        assert "subject" in stats["top_expenses"][0]

    # --- recurring ---

    def test_recurring_count_and_total_from_kind_field(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_recurring_expense(hh, owner, "30.00", month="2026-06")
        _make_recurring_expense(hh, owner, "20.00", month="2026-06")
        _make_expense(hh, owner, "50.00", month="2026-06")  # manual — should not count
        stats = compute_month_stats(hh, "2026-06")
        assert stats["recurring"]["count"] == 2
        assert Decimal(stats["recurring"]["total"]) == Decimal("50.00")

    def test_recurring_zero_when_no_recurring_expenses(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-06")
        stats = compute_month_stats(hh, "2026-06")
        assert stats["recurring"]["count"] == 0

    # --- trend ---

    def test_trend_delta_and_pct_vs_previous_month(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense(hh, owner, "1000.00", month="2026-05")  # prev month
        _make_expense(hh, owner, "1100.00", month="2026-06")  # target month
        stats = compute_month_stats(hh, "2026-06")
        assert Decimal(stats["prev_total"]) == Decimal("1000.00")
        assert Decimal(stats["trend_delta"]) == Decimal("100.00")
        assert stats["trend_pct"] == pytest.approx(10.0, abs=0.05)

    def test_trend_pct_none_when_prev_month_zero(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense(hh, owner, "200.00", month="2026-06")
        # no expense in 2026-05
        stats = compute_month_stats(hh, "2026-06")
        assert stats["trend_pct"] is None

    def test_trend_prev_month_key_correct(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        stats = compute_month_stats(hh, "2026-06")
        assert stats["prev_month"] == "2026-05"

    # --- cross-household isolation ---

    def test_other_household_expenses_not_counted(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        _make_expense(hh_b, owner_b, "9999.00", month="2026-06")
        stats = compute_month_stats(hh_a, "2026-06")
        assert Decimal(stats["total_spent"]) == Decimal("0.00")

    # --- expense_count ---

    def test_expense_count_matches_number_of_interactions(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense(hh, owner, "10.00", month="2026-06")
        _make_expense(hh, owner, "20.00", month="2026-06")
        _make_expense(hh, owner, "30.00", month="2026-06")
        stats = compute_month_stats(hh, "2026-06")
        assert stats["expense_count"] == 3
