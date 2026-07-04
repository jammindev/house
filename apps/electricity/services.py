"""
Consumption services — single source of truth for meter-reading writes and
consumption aggregation.

Extracted so both the REST API and the agent's ``create_entity`` tool write
readings the same way (validation through ``MeterReadingSerializer``, then
regeneration of the derived daily estimates). Callers pass an explicit
``household`` + ``user`` (the agent has no ``request``).
"""
from __future__ import annotations

from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Q, Sum
from django.db.models.functions import TruncDay, TruncHour, TruncMonth, TruncYear

from .models import (
    ConsumptionRecord,
    ConsumptionSource,
    ElectricityMeter,
    MeterReading,
)

# Bucket function + max record interval (minutes) allowed into that bucket.
# The honesty rule: a bucket never includes points coarser than itself, so the
# hourly view cannot show a daily estimate derived from manual readings.
GRANULARITIES = {
    "hour": (TruncHour, 60),
    "day": (TruncDay, 24 * 60),
    "month": (TruncMonth, None),
    "year": (TruncYear, None),
}


def meter_tz(meter: ElectricityMeter) -> ZoneInfo:
    try:
        return ZoneInfo(meter.timezone)
    except Exception:
        return ZoneInfo("UTC")


# --- meter readings -----------------------------------------------------------


def create_meter_reading(household, user, *, meter, register, reading_at, index_kwh) -> MeterReading:
    """Create a reading for ``household`` on behalf of ``user``.

    Reuses ``MeterReadingSerializer`` so validation (meter scope, register vs
    tariff coherence, index monotonicity) stays in one place, then regenerates
    the derived estimates. This is the write path shared by the viewset and the
    agent's ``create_entity``.
    """
    from .serializers import MeterReadingSerializer

    payload = {
        "meter": getattr(meter, "pk", meter),
        "register": register,
        "reading_at": reading_at,
        "index_kwh": index_kwh,
    }
    serializer = MeterReadingSerializer(data=payload, context={"household_id": household.id})
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        reading = serializer.save(household=household, created_by=user, updated_by=user)
        rebuild_reading_records(reading.meter, reading.register)
    return reading


def update_meter_reading(household, user, reading: MeterReading, *, fields: dict) -> MeterReading:
    """Update ``reading`` and regenerate the derived estimates.

    A meter or register change regenerates both the old and the new series.
    """
    from .serializers import MeterReadingSerializer

    old_pair = (reading.meter, reading.register)
    allowed = {"meter", "register", "reading_at", "index_kwh"}
    payload = {k: v for k, v in fields.items() if k in allowed}
    serializer = MeterReadingSerializer(
        reading, data=payload, partial=True, context={"household_id": household.id}
    )
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        reading = serializer.save(updated_by=user)
        rebuild_reading_records(reading.meter, reading.register)
        if old_pair != (reading.meter, reading.register):
            rebuild_reading_records(*old_pair)
    return reading


def delete_meter_reading(reading: MeterReading) -> None:
    """Delete ``reading`` and regenerate the derived estimates."""
    meter, register = reading.meter, reading.register
    with transaction.atomic():
        reading.delete()
        rebuild_reading_records(meter, register)


def rebuild_reading_records(meter: ElectricityMeter, register: str) -> int:
    """Regenerate the reading-derived ``ConsumptionRecord`` series.

    The delta between two consecutive readings of the same register is spread
    over the covered period, split at local-midnight boundaries of the meter's
    timezone, pro rata of the seconds each segment covers (so DST days of
    23 h / 25 h come out right). Rounding is cumulative: the segment energies
    always sum exactly to the delta. Deterministic and idempotent — the whole
    series for (meter, register) is deleted and rebuilt on every reading write.

    Returns the number of records created.
    """
    readings = list(
        MeterReading.objects.filter(meter=meter, register=register).order_by("reading_at")
    )
    ConsumptionRecord.objects.filter(
        meter=meter, register=register, source=ConsumptionSource.READING
    ).delete()

    tz = meter_tz(meter)
    records: list[ConsumptionRecord] = []
    for prev, curr in zip(readings, readings[1:]):
        # All arithmetic in UTC: subtracting two datetimes that share the same
        # ZoneInfo uses wall-clock (not absolute) time, which is wrong across
        # DST transitions.
        cursor = prev.reading_at.astimezone(dt_timezone.utc)
        end_utc = curr.reading_at.astimezone(dt_timezone.utc)
        delta_wh = int(round((curr.index_kwh - prev.index_kwh) * 1000))
        total_seconds = (end_utc - cursor).total_seconds()
        if delta_wh < 0 or total_seconds <= 0:
            continue  # guarded by serializer validation; never trust silently
        elapsed = 0.0
        allocated = 0
        while cursor < end_utc:
            local = cursor.astimezone(tz)
            next_midnight = datetime.combine(
                local.date() + timedelta(days=1), time.min, tzinfo=tz
            ).astimezone(dt_timezone.utc)
            segment_end = min(next_midnight, end_utc)
            seg_seconds = (segment_end - cursor).total_seconds()
            elapsed += seg_seconds
            seg_wh = int(round(delta_wh * elapsed / total_seconds)) - allocated
            allocated += seg_wh
            records.append(
                ConsumptionRecord(
                    household=meter.household,
                    meter=meter,
                    register=register,
                    ts_start=cursor,
                    interval_minutes=max(1, int(seg_seconds // 60)),
                    energy_wh=seg_wh,
                    source=ConsumptionSource.READING,
                )
            )
            cursor = segment_end

    ConsumptionRecord.objects.bulk_create(records)
    return len(records)


# --- aggregation ---------------------------------------------------------------


def consumption_summary(household, meter: ElectricityMeter, *, granularity: str, date_from, date_to) -> dict:
    """Aggregate consumption into buckets of ``granularity``.

    ``date_from`` / ``date_to`` are inclusive local dates of the meter's
    timezone (the range covers [date_from 00:00, date_to+1day 00:00) local).
    Buckets are truncated in the meter timezone; only records whose
    ``interval_minutes`` fits the bucket are included (honesty rule), and each
    bucket carries ``estimated_wh`` (the reading-derived share) so the UI can
    flag estimates.
    """
    if granularity not in GRANULARITIES:
        raise ValueError(f"unknown granularity: {granularity}")
    trunc, max_interval = GRANULARITIES[granularity]
    tz = meter_tz(meter)

    start = datetime.combine(date_from, time.min, tzinfo=tz)
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=tz)

    qs = ConsumptionRecord.objects.filter(
        household=household,
        meter=meter,
        ts_start__gte=start,
        ts_start__lt=end,
    )
    if max_interval is not None:
        qs = qs.filter(interval_minutes__lte=max_interval)

    rows = (
        qs.annotate(bucket=trunc("ts_start", tzinfo=tz))
        .values("bucket", "register")
        .annotate(
            energy=Sum("energy_wh"),
            estimated=Sum("energy_wh", filter=Q(source=ConsumptionSource.READING)),
        )
        .order_by("bucket")
    )

    buckets: dict[datetime, dict] = {}
    for row in rows:
        bucket = buckets.setdefault(
            row["bucket"],
            {"ts": row["bucket"], "total_wh": 0, "estimated_wh": 0, "registers": {}},
        )
        bucket["total_wh"] += row["energy"]
        bucket["estimated_wh"] += row["estimated"] or 0
        bucket["registers"][row["register"]] = (
            bucket["registers"].get(row["register"], 0) + row["energy"]
        )

    ordered = [buckets[key] for key in sorted(buckets)]
    return {
        "meter": str(meter.id),
        "granularity": granularity,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "timezone": str(tz.key),
        "total_wh": sum(b["total_wh"] for b in ordered),
        "estimated_wh": sum(b["estimated_wh"] for b in ordered),
        "buckets": [
            {
                "ts": b["ts"].astimezone(tz).isoformat(),
                "total_wh": b["total_wh"],
                "estimated_wh": b["estimated_wh"],
                "registers": b["registers"],
            }
            for b in ordered
        ],
    }
