"""
Proactive ping of the water module: the monthly meter-reading reminder.

Registered as ``PingSpec('water_reading')`` from ``apps.py::ready()``. The
reminder interval is not a scheduler concept: ``build_message`` simply returns
``None`` while the latest reading is fresh enough, so the ping fires the first
day the last index turns one month old ("never ask for data already entered").
The user's reply flows through the regular Telegram → ``agent.service.ask``
pipeline and lands in the existing ``water_reading`` writable.
"""
from __future__ import annotations

from datetime import date, timedelta

from django.utils.formats import date_format
from django.utils.translation import gettext as _

from .models import WaterReading

REMINDER_INTERVAL_DAYS = 30


def build_water_ping(household, user, *, today: date) -> str | None:
    """The monthly reminder, or ``None`` when there is nothing to ask.

    Skips while the household never logged a reading (the module is unused —
    a reminder would be spam, not help) and while the latest reading is less
    than ``REMINDER_INTERVAL_DAYS`` old.
    """
    latest = (
        WaterReading.objects.filter(household=household)
        .order_by("-reading_date")
        .first()
    )
    if latest is None:
        return None
    if latest.reading_date > today - timedelta(days=REMINDER_INTERVAL_DAYS):
        return None
    return _(
        "💧 It's been a while since your last water meter reading "
        "({index} m³ on {date}) — what does the meter show today?"
    ).format(
        index=f"{latest.index_m3:g}",
        date=date_format(latest.reading_date, "DATE_FORMAT"),
    )
