"""
Proactive ping of the electricity module: the monthly meter-reading reminder.

Registered as ``PingSpec('meter_reading')`` from ``apps.py::ready()``. Same
philosophy as the water reminder: the interval lives in ``build_message`` (a
meter is "due" when its latest reading is a month old), the scheduler knows
nothing about frequencies. Multi-meter households get one message listing
every due meter; a meter that never had a reading is left alone (unused ≠
overdue). The reply lands in the existing ``meter_reading`` writable.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone as dt_timezone

from django.utils.formats import date_format
from django.utils.translation import gettext as _

from .models import ElectricityMeter, MeterReading

REMINDER_INTERVAL_DAYS = 30


def build_meter_ping(household, user, *, today: date) -> str | None:
    """The monthly reminder, or ``None`` when no meter is due.

    A meter is due when its most recent reading (any register) is at least
    ``REMINDER_INTERVAL_DAYS`` old. Inactive meters and meters without any
    reading are skipped — only meters the household actually tracks get a
    reminder.
    """
    due = []
    for meter in ElectricityMeter.objects.filter(household=household, is_active=True):
        latest = (
            MeterReading.objects.filter(meter=meter).order_by("-reading_at").first()
        )
        if latest is None:
            continue
        if latest.reading_at >= _threshold(today):
            continue
        due.append((meter, latest))
    if not due:
        return None

    if len(due) == 1:
        meter, latest = due[0]
        return _(
            "⚡ It's been a while since the last reading of meter “{name}” "
            "({index} kWh on {date}) — what does it show today?"
        ).format(name=meter.name, **_reading_parts(latest))

    lines = [_("⚡ Some electricity meters are overdue for a reading:")]
    lines.extend(
        _("• {name} — last reading {index} kWh on {date}").format(
            name=meter.name, **_reading_parts(latest)
        )
        for meter, latest in due
    )
    lines.append(_("What do they show today?"))
    return "\n".join(lines)


def _threshold(today: date) -> datetime:
    """Readings at or after this instant are fresh enough to skip the meter."""
    return datetime.combine(
        today - timedelta(days=REMINDER_INTERVAL_DAYS), time.min, tzinfo=dt_timezone.utc
    )


def _reading_parts(latest: MeterReading) -> dict:
    return {
        "index": f"{latest.index_kwh:g}",
        "date": date_format(latest.reading_at.date(), "DATE_FORMAT"),
    }
