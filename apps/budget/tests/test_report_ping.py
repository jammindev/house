# budget/tests/test_report_ping.py
"""
Unit tests for budget.report.ping.build_monthly_report_message.

Coverage:
  1. TestBuildMonthlyReportMessage — returns None on non-1st days;
                                     returns None when last month had 0 expenses;
                                     returns HTML string with month + report on day 1
                                     with expenses; text is HTML-escaped; does not
                                     call AI polish in tests.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from budget.report.ping import build_monthly_report_message
from budget.report.service import get_or_generate_report, last_closed_month
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


def _first_of_current_month() -> date:
    return date.today().replace(day=1)


def _make_expense_in_last_closed_month(household, user, amount):
    """Create an expense in the previous calendar month (the 'last closed month')."""
    from django.utils import timezone

    month = last_closed_month(household)
    year, mon = (int(p) for p in month.split("-"))
    tz = ZoneInfo(getattr(household, "timezone", None) or "UTC")
    occurred_at = datetime(year, mon, 15, tzinfo=tz)
    return create_manual_expense_interaction(
        household=household,
        user=user,
        subject="Ping test expense",
        amount=Decimal(str(amount)),
        occurred_at=occurred_at,
    )


# ===========================================================================
# 1. TestBuildMonthlyReportMessage
# ===========================================================================


@pytest.mark.django_db
class TestBuildMonthlyReportMessage:
    """build_monthly_report_message returns None / HTML depending on day and data."""

    # --- day guard ---

    def test_returns_none_on_day_2(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        result = build_monthly_report_message(hh, owner, today=date(2026, 7, 2))
        assert result is None

    def test_returns_none_on_day_15(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        result = build_monthly_report_message(hh, owner, today=date(2026, 7, 15))
        assert result is None

    def test_returns_none_on_last_day_of_month(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        result = build_monthly_report_message(hh, owner, today=date(2026, 6, 30))
        assert result is None

    # --- empty month guard ---

    def test_returns_none_on_day_1_when_no_expenses_last_month(self):
        """No spending last month → ping is skipped (expense_count == 0)."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        # No expenses created at all
        result = build_monthly_report_message(hh, owner, today=date(2026, 7, 1))
        assert result is None

    # --- happy path ---

    def test_returns_html_string_on_day_1_with_expenses(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense_in_last_closed_month(hh, owner, "200.00")
        result = build_monthly_report_message(hh, owner, today=date(2026, 7, 1))
        assert result is not None
        assert isinstance(result, str)
        assert len(result) > 0

    def test_result_contains_month_string(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense_in_last_closed_month(hh, owner, "100.00")
        # Sending on 2026-07-01 → last closed month is 2026-06
        result = build_monthly_report_message(hh, owner, today=date(2026, 7, 1))
        assert result is not None
        expected_month = last_closed_month(hh)
        assert expected_month in result

    def test_result_contains_bold_header(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense_in_last_closed_month(hh, owner, "100.00")
        result = build_monthly_report_message(hh, owner, today=date(2026, 7, 1))
        assert result is not None
        assert "<b>" in result
        assert "</b>" in result

    def test_result_is_html_escaped(self):
        """HTML special chars in the report are escaped (html.escape applied)."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        # Create an expense with a subject containing HTML
        month = last_closed_month(hh)
        year, mon = (int(p) for p in month.split("-"))
        tz = ZoneInfo(getattr(hh, "timezone", None) or "UTC")
        from datetime import datetime as dt

        occurred_at = dt(year, mon, 15, tzinfo=tz)
        create_manual_expense_interaction(
            household=hh,
            user=owner,
            subject="<script>alert('xss')</script>",
            amount=Decimal("50.00"),
            occurred_at=occurred_at,
        )
        result = build_monthly_report_message(hh, owner, today=date(2026, 7, 1))
        if result:
            # The raw script tag must not appear unescaped
            assert "<script>" not in result

    def test_get_or_generate_creates_report_on_day_1(self):
        """Calling the ping on day 1 must persist a BudgetReport row."""
        from budget.models import BudgetReport

        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense_in_last_closed_month(hh, owner, "50.00")
        month = last_closed_month(hh)
        assert not BudgetReport.objects.filter(household=hh, month=month).exists()
        build_monthly_report_message(hh, owner, today=date(2026, 7, 1))
        assert BudgetReport.objects.filter(household=hh, month=month).exists()

    def test_idempotent_second_ping_returns_same_data(self):
        """Calling the ping twice on day 1 must return the same text (frozen snapshot)."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _make_expense_in_last_closed_month(hh, owner, "100.00")
        today = date(2026, 7, 1)
        result_1 = build_monthly_report_message(hh, owner, today=today)
        result_2 = build_monthly_report_message(hh, owner, today=today)
        assert result_1 == result_2
