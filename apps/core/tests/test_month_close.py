# core/tests/test_month_close.py
"""
The closing date of a month (issue #541).

A recap and a budget report are frozen once and never recomputed, so the day they
freeze decides what they can ever contain. These tests pin the arithmetic that
decides it: a month closes on the 5th business day of the next one, which is what
gives the household the first days of the month to record the last receipts.

Coverage:
  1. TestNthBusinessDay          — weekends skipped, month rollover, guards
  2. TestClosingDate             — when a given month becomes tellable
  3. TestLastClosedMonth         — the grace period seen from a calendar day
  4. TestEveryCallerAgrees       — one definition, four callers
"""
from __future__ import annotations

from datetime import date

import pytest

from core.month_close import (
    CLOSING_BUSINESS_DAY,
    closing_date,
    last_closed_month,
    next_month,
    nth_business_day,
    previous_month,
)


class TestNthBusinessDay:
    def test_the_first_is_the_first_business_day_when_it_is_a_weekday(self):
        # 1 July 2026 is a Wednesday.
        assert nth_business_day(2026, 7, 1) == date(2026, 7, 1)

    def test_a_weekend_start_pushes_the_count_to_monday(self):
        # 1 August 2026 is a Saturday: Monday the 3rd is business day #1.
        assert nth_business_day(2026, 8, 1) == date(2026, 8, 3)

    def test_five_business_days_skip_the_weekend_in_between(self):
        # Wed 1 → Thu 2 → Fri 3 → Mon 6 → Tue 7.
        assert nth_business_day(2026, 7) == date(2026, 7, 7)

    def test_a_month_opening_on_a_sunday(self):
        assert nth_business_day(2026, 2) == date(2026, 2, 6)

    def test_the_default_is_the_configured_closing_day(self):
        assert nth_business_day(2026, 7) == nth_business_day(2026, 7, CLOSING_BUSINESS_DAY)

    def test_zero_is_refused_rather_than_silently_meaning_the_first(self):
        with pytest.raises(ValueError):
            nth_business_day(2026, 7, 0)

    def test_asking_for_more_business_days_than_the_month_has_raises(self):
        """A misconfiguration must explode, never return a date in the next month."""
        with pytest.raises(ValueError):
            nth_business_day(2026, 2, 25)


class TestClosingDate:
    def test_july_closes_in_august(self):
        assert closing_date("2026-07") == date(2026, 8, 7)

    def test_december_closes_in_january_of_the_next_year(self):
        assert closing_date("2026-12") == date(2027, 1, 7)

    def test_it_is_never_the_first_of_the_month(self):
        """The whole point: the 1st no longer closes anything."""
        for month in (f"2026-{m:02d}" for m in range(1, 13)):
            assert closing_date(month).day != 1


class TestLastClosedMonth:
    """``household`` is unused when ``today`` is given — these are pure dates."""

    def test_the_first_of_august_has_not_closed_july_yet(self):
        assert last_closed_month(None, today=date(2026, 8, 1)) == "2026-06"

    def test_the_day_before_the_closing_day_still_holds(self):
        assert last_closed_month(None, today=date(2026, 8, 6)) == "2026-06"

    def test_the_closing_day_hands_july_over(self):
        assert last_closed_month(None, today=date(2026, 8, 7)) == "2026-07"

    def test_it_stays_july_for_the_rest_of_august(self):
        assert last_closed_month(None, today=date(2026, 8, 31)) == "2026-07"

    def test_the_year_rolls_over_during_the_grace_period(self):
        assert last_closed_month(None, today=date(2027, 1, 6)) == "2026-11"
        assert last_closed_month(None, today=date(2027, 1, 7)) == "2026-12"

    def test_a_closed_month_closed_on_its_own_closing_date(self):
        """The two functions are each other's inverse over a whole year."""
        for day in (date(2026, m, d) for m in range(1, 13) for d in (1, 7, 15, 28)):
            month = last_closed_month(None, today=day)
            assert closing_date(month) <= day
            assert closing_date(next_month(month)) > day


class TestMonthArithmetic:
    def test_january_steps_back_across_the_year(self):
        assert previous_month("2026-01") == "2025-12"

    def test_december_steps_forward_across_the_year(self):
        assert next_month("2026-12") == "2027-01"

    def test_they_undo_each_other(self):
        assert next_month(previous_month("2026-07")) == "2026-07"


class TestEveryCallerAgrees:
    """One definition, four callers — the two pings and the two ``latest``
    endpoints. Two copies of this rule would let the recap and the budget report
    close the month on different days, and the household would have no way to
    tell which of the two is lying."""

    def test_the_recap_and_the_budget_report_share_the_function(self):
        from budget.report.service import last_closed_month as budget_version
        from recap.service import last_closed_month as recap_version

        assert budget_version is last_closed_month
        assert recap_version is last_closed_month
