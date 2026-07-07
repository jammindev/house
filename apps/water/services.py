"""
Water services — single source of truth for reading writes and consumption
aggregation.

The REST viewset and the agent's ``create_entity`` / ``update_entity`` both
write readings through these functions (validation through
``WaterReadingSerializer``), so there is exactly one write path. Callers pass
an explicit ``household`` + ``user`` (the agent has no ``request``).

Consumption is not stored: it is derived on the fly from the deltas between
consecutive readings. The delta between two readings is spread evenly over the
covered days with cumulative rounding (in litres), so the daily volumes always
sum exactly to the delta — the same proration contract as the electricity
``rebuild_reading_records``, without the derived table (readings are date-only
and low-volume, a recompute per request is cheap).
"""
from __future__ import annotations

from datetime import date, timedelta

from .models import WaterReading

GRANULARITIES = ("day", "month", "year")


# --- readings -------------------------------------------------------------------


def create_water_reading(household, user, *, reading_date, index_m3) -> WaterReading:
    """Create a reading for ``household`` on behalf of ``user``.

    Reuses ``WaterReadingSerializer`` so validation (index monotonicity, one
    reading per day) stays in one place. This is the write path shared by the
    viewset and the agent's ``create_entity``.
    """
    from .serializers import WaterReadingSerializer

    payload = {"reading_date": reading_date, "index_m3": index_m3}
    serializer = WaterReadingSerializer(data=payload, context={"household_id": household.id})
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user, updated_by=user)


def update_water_reading(household, user, reading: WaterReading, *, fields: dict) -> WaterReading:
    """Update ``reading`` through the same serializer validation as create."""
    from .serializers import WaterReadingSerializer

    allowed = {"reading_date", "index_m3"}
    payload = {k: v for k, v in fields.items() if k in allowed}
    serializer = WaterReadingSerializer(
        reading, data=payload, partial=True, context={"household_id": household.id}
    )
    serializer.is_valid(raise_exception=True)
    return serializer.save(updated_by=user)


# --- aggregation ------------------------------------------------------------------


def consumption_summary(household, *, granularity: str, date_from: date, date_to: date) -> dict:
    """Aggregate the derived daily consumption into buckets of ``granularity``.

    ``date_from`` / ``date_to`` are inclusive calendar dates. The delta between
    two consecutive readings is spread over [prev date, curr date), one share
    per day, with cumulative rounding in litres (the shares always sum exactly
    to the delta). Volumes are returned in litres (integers) — the UI converts
    to m³, exactly like the electricity summary returns Wh for a kWh display.
    """
    if granularity not in GRANULARITIES:
        raise ValueError(f"unknown granularity: {granularity}")

    readings = list(
        WaterReading.objects.filter(household=household).order_by("reading_date")
    )

    daily: dict[date, int] = {}
    for prev, curr in zip(readings, readings[1:]):
        n_days = (curr.reading_date - prev.reading_date).days
        delta_l = int(round((curr.index_m3 - prev.index_m3) * 1000))
        if n_days <= 0 or delta_l < 0:
            continue  # guarded by serializer validation; never trust silently
        # Covered days are [prev, curr) — skip pairs fully outside the window.
        if curr.reading_date <= date_from or prev.reading_date > date_to:
            continue
        allocated = 0
        for k in range(1, n_days + 1):
            share = int(round(delta_l * k / n_days)) - allocated
            allocated += share
            day = prev.reading_date + timedelta(days=k - 1)
            if date_from <= day <= date_to:
                daily[day] = daily.get(day, 0) + share

    def bucket_key(day: date) -> date:
        if granularity == "month":
            return day.replace(day=1)
        if granularity == "year":
            return day.replace(month=1, day=1)
        return day

    buckets: dict[date, int] = {}
    for day, litres in daily.items():
        key = bucket_key(day)
        buckets[key] = buckets.get(key, 0) + litres

    return {
        "granularity": granularity,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "total_l": sum(buckets.values()),
        "buckets": [
            # Local-naive midnight: the frontend parses it in the browser's zone.
            {"ts": f"{key.isoformat()}T00:00:00", "total_l": volume}
            for key, volume in sorted(buckets.items())
        ],
    }
