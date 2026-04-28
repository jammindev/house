"""Domain helpers for the equipment app."""

import calendar
from datetime import date


def compute_next_service_due(last_service_at, maintenance_interval_months) -> date | None:
    """Return the next maintenance date or ``None`` if it cannot be computed."""
    if not last_service_at or not maintenance_interval_months:
        return None

    total_month = last_service_at.month - 1 + maintenance_interval_months
    year = last_service_at.year + total_month // 12
    month = total_month % 12 + 1
    max_day = calendar.monthrange(year, month)[1]
    day = min(last_service_at.day, max_day)
    return last_service_at.replace(year=year, month=month, day=day)
