"""Schedule helpers for briefings — timezone, next-fire, validation.

The schedule is two arrays interpreted in the household timezone: ``send_times``
(local times of day) and ``weekdays`` (Python weekday ints, empty = every day).
This module turns them into a next-fire instant (for the UI) and enforces the
anti-spam guard (slots at least an hour apart). Mirrors the timezone handling of
``pings.services``.
"""
from __future__ import annotations

import logging
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

logger = logging.getLogger(__name__)

MIN_SLOT_GAP = timedelta(hours=1)


def household_tz(household) -> ZoneInfo:
    """The household's timezone, falling back to UTC (same as pings)."""
    name = getattr(household, "timezone", "") or "UTC"
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning("briefings: invalid household timezone %r, using UTC", name)
        return ZoneInfo("UTC")


def next_send_at(briefing, *, now: datetime | None = None) -> datetime | None:
    """Next instant this briefing fires, or ``None`` if it never will.

    ``None`` when inactive or without a schedule. Searches up to 8 days ahead so
    a weekday-restricted briefing still resolves its next occurrence.
    """
    if not briefing.is_active or not briefing.send_times:
        return None

    tz = household_tz(briefing.household)
    now = now or timezone.now()
    local_now = now.astimezone(tz)
    times = sorted(briefing.send_times)
    days = set(briefing.weekdays) if briefing.weekdays else set(range(7))

    for delta in range(8):
        day = (local_now + timedelta(days=delta)).date()
        if day.weekday() not in days:
            continue
        for slot in times:
            candidate = datetime.combine(day, slot, tzinfo=tz)
            if candidate > local_now:
                return candidate
    return None


def validate_schedule(send_times: list[time], weekdays: list[int]) -> None:
    """Raise ``ValueError`` on an invalid schedule (bad weekday, slots too close).

    Callers (the serializer) translate this into a DRF validation error. Times
    less than an hour apart are rejected — the anti-cost guard from the cadrage.
    """
    for wd in weekdays or []:
        if wd < 0 or wd > 6:
            raise ValueError("weekdays must be integers between 0 (Mon) and 6 (Sun)")

    ordered = sorted(send_times or [])
    for earlier, later in zip(ordered, ordered[1:]):
        gap = datetime.combine(datetime.min, later) - datetime.combine(datetime.min, earlier)
        if gap < MIN_SLOT_GAP:
            raise ValueError("send times must be at least one hour apart")
