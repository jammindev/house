# budget/tests/test_report_service.py
"""
Unit tests for budget.report.service.

Coverage:
  1. TestLastClosedMonth     — returns previous calendar month in household tz
  2. TestGetOrGenerateReport — idempotency, snapshot freezing, race-safety shape
  3. TestRenderReport        — deterministic text in fr vs en, no AI polish in tests
"""
from __future__ import annotations

from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone, translation

from budget.models import BudgetReport
from budget.report.service import (
    get_or_generate_report,
    last_closed_month,
    render_report,
)
from budget.services import create_budget
from households.models import HouseholdMember
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


def _make_expense(household, user, amount, *, month):
    from datetime import datetime

    tz = ZoneInfo(getattr(household, "timezone", None) or "UTC")
    year, mon = (int(p) for p in month.split("-"))
    occurred_at = datetime(year, mon, 15, tzinfo=tz)
    return create_manual_expense_interaction(
        household=household,
        user=user,
        subject="Test expense",
        amount=Decimal(str(amount)),
        occurred_at=occurred_at,
    )


def _minimal_stats(month: str) -> dict:
    """Minimal valid stats dict for testing render_report."""
    return {
        "month": month,
        "total_spent": "100.00",
        "prev_month": "2026-05",
        "prev_total": "80.00",
        "trend_delta": "20.00",
        "trend_pct": 25.0,
        "budgets": [],
        "unbudgeted": "0.00",
        "top_expenses": [{"subject": "Cinema", "amount": "100.00"}],
        "recurring": {"count": 0, "total": "0.00"},
        "global": None,
        "expense_count": 1,
    }


# ===========================================================================
# 1. TestLastClosedMonth
# ===========================================================================


@pytest.mark.django_db
class TestLastClosedMonth:
    """last_closed_month returns the previous calendar month in household tz."""

    def test_returns_previous_month_string(self):
        hh = HouseholdFactory()
        result = last_closed_month(hh)
        # The result must be a valid YYYY-MM string (two parts separated by -)
        parts = result.split("-")
        assert len(parts) == 2
        assert len(parts[0]) == 4  # year
        assert len(parts[1]) == 2  # zero-padded month

    def test_result_is_before_current_month(self):
        hh = HouseholdFactory()
        now = timezone.now()
        current_month = f"{now.year:04d}-{now.month:02d}"
        result = last_closed_month(hh)
        assert result < current_month

    def test_household_without_timezone_uses_utc(self):
        hh = HouseholdFactory()
        hh.timezone = ""  # blank → UTC fallback (column is NOT NULL, default='')
        hh.save()
        # Should not raise — falls back to UTC
        result = last_closed_month(hh)
        assert "-" in result


# ===========================================================================
# 2. TestGetOrGenerateReport
# ===========================================================================


@pytest.mark.django_db
class TestGetOrGenerateReport:
    """get_or_generate_report is idempotent and freezes the snapshot on first call."""

    def test_creates_report_on_first_call(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-05")
        report = get_or_generate_report(hh, "2026-05")
        assert BudgetReport.objects.filter(id=report.id).exists()

    def test_report_has_correct_month_and_household(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        report = get_or_generate_report(hh, "2026-05")
        assert report.month == "2026-05"
        assert report.household_id == hh.id

    def test_second_call_returns_same_report(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense(hh, owner, "200.00", month="2026-05")
        report_1 = get_or_generate_report(hh, "2026-05")
        report_2 = get_or_generate_report(hh, "2026-05")
        assert report_1.id == report_2.id

    def test_snapshot_frozen_after_first_call(self):
        """Adding a budget after the report was generated must not change stats."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense(hh, owner, "300.00", month="2026-04")
        report = get_or_generate_report(hh, "2026-04")
        original_total = report.stats["total_spent"]

        # Add a new budget AFTER the report is frozen
        create_budget(hh, owner, name="New Budget", monthly_amount=Decimal("500"))
        report_again = get_or_generate_report(hh, "2026-04")
        assert report_again.stats["total_spent"] == original_total

    def test_stats_json_contains_required_keys(self):
        hh = HouseholdFactory()
        report = get_or_generate_report(hh, "2026-03")
        for key in ("total_spent", "budgets", "unbudgeted", "expense_count"):
            assert key in report.stats

    def test_different_months_get_different_reports(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        report_may = get_or_generate_report(hh, "2026-05")
        report_apr = get_or_generate_report(hh, "2026-04")
        assert report_may.id != report_apr.id
        assert report_may.month == "2026-05"
        assert report_apr.month == "2026-04"

    def test_different_households_get_different_reports(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        report_a = get_or_generate_report(hh_a, "2026-05")
        report_b = get_or_generate_report(hh_b, "2026-05")
        assert report_a.id != report_b.id
        assert report_a.household_id == hh_a.id
        assert report_b.household_id == hh_b.id


# ===========================================================================
# 3. TestRenderReport
# ===========================================================================


@pytest.mark.django_db
class TestRenderReport:
    """render_report produces deterministic text, no network calls in tests."""

    def _make_report(self, household, month, stats=None):
        stats = stats or _minimal_stats(month)
        return BudgetReport.objects.create(
            household=household,
            month=month,
            stats=stats,
        )

    def test_returns_non_empty_string(self):
        hh = HouseholdFactory()
        report = self._make_report(hh, "2026-05")
        text = render_report(report, polish=False)
        assert isinstance(text, str)
        assert len(text) > 0

    def test_no_polish_uses_deterministic_template(self):
        """With polish=False the LLM is never called — text is always deterministic."""
        hh = HouseholdFactory()
        report = self._make_report(hh, "2026-05")
        # Call twice — must return identical text
        text_1 = render_report(report, lang="en", polish=False)
        text_2 = render_report(report, lang="en", polish=False)
        assert text_1 == text_2

    def test_render_with_explicit_lang_parameter(self):
        """render_report accepts a lang parameter without raising."""
        hh = HouseholdFactory()
        report = self._make_report(hh, "2026-05")
        text_en = render_report(report, lang="en", polish=False)
        text_fr = render_report(report, lang="fr", polish=False)
        # Both must produce non-empty text regardless of translation compilation status
        assert text_en
        assert text_fr

    def test_polish_false_when_setting_disabled(self):
        """BUDGET_REPORT_AI_POLISH_ENABLED=False → falls back to deterministic."""
        from django.test import override_settings

        hh = HouseholdFactory()
        report = self._make_report(hh, "2026-05")
        with override_settings(BUDGET_REPORT_AI_POLISH_ENABLED=False):
            text = render_report(report, lang="en", polish=True)
        # Should get deterministic text (non-empty, no crash)
        assert text

    def test_stats_total_spent_appears_in_text(self):
        hh = HouseholdFactory()
        stats = _minimal_stats("2026-05")
        stats["total_spent"] = "123.45"
        report = self._make_report(hh, "2026-05", stats=stats)
        text = render_report(report, lang="en", polish=False)
        assert "123.45" in text

    def test_over_budget_line_flagged(self):
        hh = HouseholdFactory()
        stats = _minimal_stats("2026-05")
        stats["budgets"] = [
            {"name": "Food", "amount": "500.00", "spent": "600.00", "ratio": 1.2, "state": "over"}
        ]
        report = self._make_report(hh, "2026-05", stats=stats)
        text = render_report(report, lang="en", polish=False)
        # The over-budget line must be present and contain the budget name
        assert "Food" in text
        assert "over" in text.lower()

    def test_unbudgeted_line_absent_when_zero(self):
        hh = HouseholdFactory()
        stats = _minimal_stats("2026-05")
        stats["unbudgeted"] = "0.00"
        report = self._make_report(hh, "2026-05", stats=stats)
        text = render_report(report, lang="en", polish=False)
        assert "nbudgeted" not in text  # "Unbudgeted" should not appear when 0

    def test_unbudgeted_line_present_when_positive(self):
        hh = HouseholdFactory()
        stats = _minimal_stats("2026-05")
        stats["unbudgeted"] = "99.00"
        report = self._make_report(hh, "2026-05", stats=stats)
        text = render_report(report, lang="en", polish=False)
        assert "99.00" in text

    def test_trend_up_phrasing(self):
        hh = HouseholdFactory()
        stats = _minimal_stats("2026-05")
        stats["trend_pct"] = 15.0  # positive = spent more than last month
        stats["prev_total"] = "80.00"
        report = self._make_report(hh, "2026-05", stats=stats)
        text = render_report(report, lang="en", polish=False)
        assert "more" in text.lower()

    def test_trend_down_phrasing(self):
        hh = HouseholdFactory()
        stats = _minimal_stats("2026-05")
        stats["total_spent"] = "60.00"
        stats["trend_delta"] = "-20.00"
        stats["trend_pct"] = -20.0
        stats["prev_total"] = "80.00"
        report = self._make_report(hh, "2026-05", stats=stats)
        text = render_report(report, lang="en", polish=False)
        assert "less" in text.lower()

    def test_trend_flat_phrasing(self):
        hh = HouseholdFactory()
        stats = _minimal_stats("2026-05")
        stats["trend_pct"] = 0.0
        stats["prev_total"] = "100.00"
        report = self._make_report(hh, "2026-05", stats=stats)
        text = render_report(report, lang="en", polish=False)
        assert "same" in text.lower()

    def test_trend_absent_when_prev_total_zero(self):
        hh = HouseholdFactory()
        stats = _minimal_stats("2026-05")
        stats["trend_pct"] = None
        stats["prev_total"] = "0.00"
        report = self._make_report(hh, "2026-05", stats=stats)
        text = render_report(report, lang="en", polish=False)
        # Neither "more" nor "less" phrasing should appear
        assert "more than the previous" not in text.lower()
        assert "less than the previous" not in text.lower()
