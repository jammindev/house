# orchard/tests/test_seasons.py
"""
Seasonal cadence — the pure part, tested without a database.

The test that matters is the **year straddle**: « novembre → mars » is the normal
shape of an orchard rule, not an edge case. A suite that only exercises
« juin → août » passes while leaving the bug in place.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from orchard import seasons


def rule(start: int, end: int, created: date | None = None) -> SimpleNamespace:
    """A duck-typed rule — `seasons` never touches the database."""
    created_at = datetime(
        (created or date(2000, 1, 1)).year,
        (created or date(2000, 1, 1)).month,
        (created or date(2000, 1, 1)).day,
        tzinfo=timezone.utc,
    )
    return SimpleNamespace(start_month=start, end_month=end, created_at=created_at)


class TestAWindowThatCrossesNewYear:
    """« Taille d'hiver : novembre → mars »."""

    WINTER = rule(11, 3)

    def test_december_and_january_belong_to_the_same_season(self):
        assert seasons.season_of(self.WINTER, date(2026, 12, 20)) == 2026
        assert seasons.season_of(self.WINTER, date(2027, 1, 15)) == 2026

    def test_the_season_is_named_after_the_year_the_window_opens(self):
        assert seasons.season_of(self.WINTER, date(2026, 11, 1)) == 2026
        assert seasons.season_of(self.WINTER, date(2027, 3, 31)) == 2026
        assert seasons.season_of(self.WINTER, date(2027, 11, 1)) == 2027

    def test_outside_the_window_belongs_to_no_season(self):
        assert seasons.season_of(self.WINTER, date(2027, 6, 15)) is None

    def test_the_bounds_span_two_calendar_years(self):
        start, end = seasons.window_bounds(self.WINTER, 2026)
        assert start == date(2026, 11, 1)
        assert end == date(2027, 3, 31)

    def test_a_pruning_in_december_satisfies_the_january_reading(self):
        """The whole point: « done this season? » is an equality on an integer.

        A « less than a year ago » subtraction answers *yes* on 2 January for a
        pruning done on 20 December — and concludes the season is over when it
        has barely begun.
        """
        state = seasons.rule_status(
            self.WINTER, today=date(2027, 1, 15), last_event_on=date(2026, 12, 20)
        )
        assert state['state'] == seasons.DONE
        assert state['season'] == 2026


class TestAWindowInsideOneYear:
    SUMMER = rule(6, 8)

    def test_the_season_is_the_calendar_year(self):
        assert seasons.season_of(self.SUMMER, date(2026, 7, 1)) == 2026
        assert seasons.season_of(self.SUMMER, date(2026, 9, 1)) is None

    def test_bounds_end_on_the_last_day_of_the_month(self):
        start, end = seasons.window_bounds(self.SUMMER, 2026)
        assert (start, end) == (date(2026, 6, 1), date(2026, 8, 31))


class TestTheFourStates:
    WINTER = rule(11, 3)

    def test_inside_the_window_with_nothing_done_is_due(self):
        state = seasons.rule_status(
            self.WINTER, today=date(2026, 12, 1), last_event_on=None
        )
        assert state['state'] == seasons.DUE
        assert state['is_due'] is True

    def test_a_closed_window_with_nothing_done_is_missed_not_due(self):
        """A shut window cannot be caught up: offering winter pruning in June is
        bad advice, not a reminder. But it is still *said*, never hidden."""
        state = seasons.rule_status(
            self.WINTER, today=date(2027, 6, 15), last_event_on=None
        )
        assert state['state'] == seasons.MISSED
        assert state['season'] == 2026

    def test_a_closed_window_that_was_honoured_is_upcoming(self):
        state = seasons.rule_status(
            self.WINTER, today=date(2027, 6, 15), last_event_on=date(2027, 2, 3)
        )
        assert state['state'] == seasons.UPCOMING
        assert state['next_window_start'] == date(2027, 11, 1)

    def test_last_season_being_done_does_not_make_this_one_done(self):
        """Last winter's pruning says nothing about this winter."""
        state = seasons.rule_status(
            self.WINTER, today=date(2027, 12, 1), last_event_on=date(2027, 2, 3)
        )
        assert state['state'] == seasons.DUE
        assert state['season'] == 2027

    def test_a_window_that_shut_before_the_rule_existed_is_not_a_reproach(self):
        """Accusing a brand-new rule of missing a season it never lived through
        is a complaint nobody can act on."""
        young = rule(11, 3, created=date(2027, 5, 1))
        state = seasons.rule_status(young, today=date(2027, 6, 15), last_event_on=None)
        assert state['state'] == seasons.UPCOMING


class TestFebruary29:
    """A window ending in February must not blow up on a leap year."""

    def test_bounds_land_on_the_real_last_day(self):
        r = rule(11, 2)
        _, end = seasons.window_bounds(r, 2027)
        assert end == date(2028, 2, 29)
        _, end = seasons.window_bounds(r, 2026)
        assert end == date(2027, 2, 28)
