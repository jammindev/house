"""
Consumption services — single source of truth for meter-reading writes and
consumption aggregation.

Extracted so both the REST API and the agent's ``create_entity`` tool write
readings the same way (validation through ``MeterReadingSerializer``, then
regeneration of the derived daily estimates). Callers pass an explicit
``household`` + ``user`` (the agent has no ``request``).
"""
from __future__ import annotations

from bisect import bisect_right
from calendar import monthrange
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import TruncDay, TruncHour

from .models import (
    ConsumptionRecord,
    ConsumptionSource,
    ElectricityMeter,
    MeterReading,
    MeterTariff,
)

GRANULARITIES = ("hour", "day", "month", "year")


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


# --- cost (parcours 10 — lot 5) --------------------------------------------------

_PRICE_FIELDS = {"base": "price_base", "hp": "price_hp", "hc": "price_hc"}


def _tariff_lookup(meter: ElectricityMeter):
    """Return (tariffs, applicable) where ``applicable(day)`` is the tariff in
    force on a local day — the row with the latest ``valid_from`` ≤ day, or None."""
    tariffs = list(MeterTariff.objects.filter(meter=meter).order_by("valid_from"))
    dates = [t.valid_from for t in tariffs]

    def applicable(day: date) -> MeterTariff | None:
        i = bisect_right(dates, day)
        return tariffs[i - 1] if i else None

    return tariffs, applicable


def _subscription_cost_eur(tariffs, applicable, tz, date_from: date, date_to: date) -> Decimal | None:
    """Subscription share of [date_from, date_to] — prorated per calendar day of
    the real month, bounded to today (never accrued in the future), starting at
    the first tariff. None when no applicable day carries a subscription (no
    misleading zero)."""
    if not tariffs:
        return None
    today_local = datetime.now(tz).date()
    day = max(date_from, tariffs[0].valid_from)
    end = min(date_to, today_local)
    total = Decimal("0")
    charged = False
    while day <= end:
        tariff = applicable(day)
        subscription = tariff.subscription_eur_month if tariff else None
        if subscription is not None:
            total += subscription / monthrange(day.year, day.month)[1]
            charged = True
        day += timedelta(days=1)
    return total if charged else None


# --- aggregation ---------------------------------------------------------------


def consumption_summary(household, meter: ElectricityMeter, *, granularity: str, date_from, date_to) -> dict:
    """Aggregate consumption into buckets of ``granularity``.

    ``date_from`` / ``date_to`` are inclusive local dates of the meter's
    timezone (the range covers [date_from 00:00, date_to+1day 00:00) local).

    Two rules shape what a bucket contains:

    - **honesty**: the hourly view only shows real measured data (imports at a
      step ≤ 60 min) — reading-derived estimates never appear in it, whatever
      their interval;
    - **source priority**: on any local day covered by imported data, the
      reading-derived estimates of that day are dropped (a period covered by
      both would double-count). Day/month/year therefore aggregate per local
      day and per source first, apply the priority, then roll days up into the
      requested bucket — month and year boundaries align with local days.

    Each bucket carries ``estimated_wh`` (the reading-derived share) so the UI
    can flag estimates.

    Costing: each local day is valued at the tariff in force that day (per
    register for HP/HC). A day with no applicable tariff or no price for its
    register contributes no cost — ``cost_eur`` / ``energy_cost_eur`` stay None
    when nothing is valued (no misleading zero). ``subscription_cost_eur`` is
    prorated per calendar day of the real month and never accrued in the future.
    """
    if granularity not in GRANULARITIES:
        raise ValueError(f"unknown granularity: {granularity}")
    tz = meter_tz(meter)

    start = datetime.combine(date_from, time.min, tzinfo=tz)
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=tz)

    qs = ConsumptionRecord.objects.filter(
        household=household,
        meter=meter,
        ts_start__gte=start,
        ts_start__lt=end,
    )

    if granularity == "hour":
        rows = (
            qs.filter(interval_minutes__lte=60)
            .exclude(source=ConsumptionSource.READING)
            .annotate(bucket=TruncHour("ts_start", tzinfo=tz))
            .values("bucket", "register")
            .annotate(energy=Sum("energy_wh"))
            .order_by("bucket")
        )
        day_rows = [
            (row["bucket"], row["register"], ConsumptionSource.IMPORT, row["energy"])
            for row in rows
        ]
    else:
        rows = (
            qs.annotate(day=TruncDay("ts_start", tzinfo=tz))
            .values("day", "register", "source")
            .annotate(energy=Sum("energy_wh"))
            .order_by("day")
        )
        import_days = {row["day"] for row in rows if row["source"] == ConsumptionSource.IMPORT}
        day_rows = [
            (row["day"], row["register"], row["source"], row["energy"])
            for row in rows
            if not (row["source"] == ConsumptionSource.READING and row["day"] in import_days)
        ]

    def bucket_key(day: datetime) -> datetime:
        local = day.astimezone(tz)
        if granularity == "month":
            return local.replace(day=1)
        if granularity == "year":
            return local.replace(month=1, day=1)
        return local  # hour and day rows are already at bucket resolution

    tariffs, tariff_for = _tariff_lookup(meter)

    buckets: dict[datetime, dict] = {}
    for day, register, source, energy in day_rows:
        key = bucket_key(day)
        bucket = buckets.setdefault(
            key,
            {"ts": key, "total_wh": 0, "estimated_wh": 0, "registers": {}, "cost_eur": None},
        )
        bucket["total_wh"] += energy
        if source == ConsumptionSource.READING:
            bucket["estimated_wh"] += energy
        bucket["registers"][register] = bucket["registers"].get(register, 0) + energy

        tariff = tariff_for(day.astimezone(tz).date())
        price = getattr(tariff, _PRICE_FIELDS[register], None) if tariff else None
        if price is not None:
            bucket["cost_eur"] = (bucket["cost_eur"] or Decimal("0")) + Decimal(energy) * price / 1000

    ordered = [buckets[key] for key in sorted(buckets)]
    costed = [b["cost_eur"] for b in ordered if b["cost_eur"] is not None]
    energy_cost = sum(costed, Decimal("0")) if costed else None
    subscription_cost = _subscription_cost_eur(tariffs, tariff_for, tz, date_from, date_to)
    total_cost = (
        None
        if energy_cost is None and subscription_cost is None
        else (energy_cost or Decimal("0")) + (subscription_cost or Decimal("0"))
    )

    def eur(value: Decimal | None) -> float | None:
        return None if value is None else round(float(value), 2)

    return {
        "meter": str(meter.id),
        "granularity": granularity,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "timezone": str(tz.key),
        "total_wh": sum(b["total_wh"] for b in ordered),
        "estimated_wh": sum(b["estimated_wh"] for b in ordered),
        "energy_cost_eur": eur(energy_cost),
        "subscription_cost_eur": eur(subscription_cost),
        "total_cost_eur": eur(total_cost),
        "buckets": [
            {
                "ts": b["ts"].astimezone(tz).isoformat(),
                "total_wh": b["total_wh"],
                "estimated_wh": b["estimated_wh"],
                "registers": b["registers"],
                "cost_eur": eur(b["cost_eur"]),
            }
            for b in ordered
        ],
    }


# --- imports --------------------------------------------------------------------


def import_consumption_file(household, user, *, meter, uploaded_file, provider=None, options=None):
    """Import a consumption file onto ``meter`` — idempotent by design.

    The whole file is parsed and validated BEFORE anything is written (no
    silent partial import); a parse failure leaves a ``ConsumptionImport``
    trace with ``status='failed'`` and zero records. Dedup happens on the
    natural key (meter, register, ts_start, source='import') via
    ``ignore_conflicts`` — re-importing the same file creates nothing.
    """
    from . import importers
    from .models import ConsumptionImport, ImportStatus

    filename = getattr(uploaded_file, "name", "") or ""
    raw = uploaded_file.read()

    if provider:
        importer = importers.get_importer(provider)
        if importer is None:
            raise importers.ImporterError(f"unknown provider: {provider}")
    else:
        importer = importers.detect_importer(raw)
        if importer is None:
            return ConsumptionImport.objects.create(
                household=household,
                meter=meter,
                provider="",
                filename=filename,
                status=ImportStatus.FAILED,
                error="format not recognized — use the generic CSV mapping",
                created_by=user,
                updated_by=user,
            )

    try:
        points = importer.parse(raw, tz=meter_tz(meter), options=options)
    except importers.ImporterError as exc:
        return ConsumptionImport.objects.create(
            household=household,
            meter=meter,
            provider=importer.key,
            filename=filename,
            status=ImportStatus.FAILED,
            error=str(exc),
            created_by=user,
            updated_by=user,
        )

    # in-file dedup on the natural key (keep the first occurrence)
    unique: dict[tuple, object] = {}
    for point in points:
        unique.setdefault((point.register, point.ts_start), point)
    deduped = list(unique.values())

    with transaction.atomic():
        imported = ConsumptionImport.objects.create(
            household=household,
            meter=meter,
            provider=importer.key,
            filename=filename,
            status=ImportStatus.COMPLETED,
            created_by=user,
            updated_by=user,
        )
        base_qs = ConsumptionRecord.objects.filter(meter=meter, source=ConsumptionSource.IMPORT)
        before = base_qs.count()
        ConsumptionRecord.objects.bulk_create(
            [
                ConsumptionRecord(
                    household=household,
                    meter=meter,
                    register=point.register,
                    ts_start=point.ts_start,
                    interval_minutes=point.interval_minutes,
                    energy_wh=point.energy_wh,
                    source=ConsumptionSource.IMPORT,
                    source_import=imported,
                    created_by=user,
                )
                for point in deduped
            ],
            ignore_conflicts=True,
        )
        created = base_qs.count() - before
        imported.created_count = created
        imported.skipped_count = len(points) - created
        imported.save(update_fields=["created_count", "skipped_count", "updated_at"])
    return imported


def preview_consumption_file(raw: bytes) -> dict:
    """Cheap preview for the import dialog: detected provider + first lines."""
    from . import importers
    from .importers.base import decode_text

    importer = importers.detect_importer(raw)
    if importer is not None:
        sample_lines = importer.sample_lines(raw)
    else:
        sample_lines = decode_text(raw).lstrip("\ufeff").splitlines()[:10]
    first_line = sample_lines[0] if sample_lines else ""
    delimiter = next((d for d in (";", ",", "\t") if d in first_line), ";")
    return {
        "detected_provider": importer.key if importer else None,
        "sample_lines": sample_lines,
        "columns": [c.strip() for c in first_line.split(delimiter)] if first_line else [],
    }
