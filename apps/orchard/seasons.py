"""
Seasonal cadence — pure functions, no database access.

The concept and everything it rejects: ``docs/fiches/CADENCE_SAISONNIERE.md``.
In one line: a seasonal rule does not say *how long since last time*, it says
*in which part of the year* — so the due date never drifts, because it never
depends on the previous one.

A **season** is identified by the year its window **opens**. For « novembre →
mars », 20 December 2026 and 15 January 2027 belong to the *same* season, 2026.
That is what makes « has it been done this season? » an equality on an integer
rather than a subtraction of dates — the subtraction answers *yes* on 2 January
for a pruning done on 20 December, and concludes the season is over when it has
barely begun.
"""
from __future__ import annotations

import calendar
from datetime import date

#: The four states a rule can be in. `missed` is deliberately not `due`: a
#: closed window cannot be caught up, and offering winter pruning in June is bad
#: advice, not a reminder.
UPCOMING = 'upcoming'
DUE = 'due'
DONE = 'done'
MISSED = 'missed'


def straddles_year(rule) -> bool:
    """True when the window runs across New Year (November → March).

    This is the **normal** case in an orchard, not the edge case: any code that
    naively tests ``start <= month <= end`` is wrong for half the catalogue.
    """
    return rule.start_month > rule.end_month


def season_of(rule, day: date) -> int | None:
    """The season ``day`` belongs to, or ``None`` when it falls outside a window."""
    month = day.month
    if not straddles_year(rule):
        return day.year if rule.start_month <= month <= rule.end_month else None
    if month >= rule.start_month:
        return day.year
    if month <= rule.end_month:
        return day.year - 1
    return None


def window_bounds(rule, season: int) -> tuple[date, date]:
    """The dated bounds of one season's window."""
    start = date(season, rule.start_month, 1)
    end_year = season + 1 if straddles_year(rule) else season
    last_day = calendar.monthrange(end_year, rule.end_month)[1]
    return start, date(end_year, rule.end_month, last_day)


def last_closed_season(rule, today: date) -> int:
    """The most recent season whose window has already shut."""
    if straddles_year(rule):
        # Windows run [start of Y … end of Y+1]; outside one, the last to close
        # ended earlier this calendar year.
        return today.year - 1
    return today.year if today.month > rule.end_month else today.year - 1


def rule_status(rule, *, today: date, last_event_on: date | None) -> dict:
    """The state of ``rule`` on ``today``, **derived** — never stored.

    A denormalized due date drifts the first time an event is edited or deleted,
    and a reminder that fires on a stale date is worse than no reminder (same
    rule as ``ChickenChore`` and the bank balance).
    """
    current = season_of(rule, today)
    done_season = season_of(rule, last_event_on) if last_event_on else None

    if current is not None:
        season = current
        state = DONE if done_season == current else DUE
    else:
        season = last_closed_season(rule, today)
        if done_season == season:
            state = UPCOMING
        else:
            # Never accuse a rule of missing a window that shut before it
            # existed — that would be a reproach nobody can act on.
            _, closed_on = window_bounds(rule, season)
            created_on = getattr(rule, 'created_at', None)
            created_on = created_on.date() if created_on is not None else None
            state = UPCOMING if created_on and created_on > closed_on else MISSED

    window_start, window_end = window_bounds(rule, season)
    # The next window to open: this season's if it has not started, next one's
    # otherwise. Shown, never stored.
    next_start, _ = window_bounds(rule, season if today < window_start else season + 1)

    return {
        'state': state,
        'season': season,
        'window_start': window_start,
        'window_end': window_end,
        'next_window_start': next_start,
        'last_done_on': last_event_on,
        'is_due': state in (DUE, MISSED),
    }
