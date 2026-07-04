import datetime as dt
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from electricity import services
from electricity.models import ConsumptionRecord, ConsumptionSource, EnergyRegister, MeterTariffType
from electricity.tests.factories import ElectricityMeterFactory, HouseholdFactory, UserFactory

pytestmark = pytest.mark.django_db

PARIS = ZoneInfo("Europe/Paris")


def test_rebuild_prorata_across_months_and_summary():
    household = HouseholdFactory()
    user = UserFactory()
    meter = ElectricityMeterFactory(household=household, timezone="Europe/Paris")

    # two readings 10 days apart, crossing a month boundary (June 26 -> July 6)
    r1 = services.create_meter_reading(
        household, user, meter=meter, register="base",
        reading_at=dt.datetime(2026, 6, 26, 0, 0, tzinfo=PARIS), index_kwh=Decimal("1000"),
    )
    r2 = services.create_meter_reading(
        household, user, meter=meter, register="base",
        reading_at=dt.datetime(2026, 7, 6, 0, 0, tzinfo=PARIS), index_kwh=Decimal("1100"),
    )
    records = ConsumptionRecord.objects.filter(meter=meter, source=ConsumptionSource.READING)
    assert records.count() == 10  # 10 full local days
    assert sum(r.energy_wh for r in records) == 100_000  # exact total preserved

    # monthly summary: June gets 5 days, July gets 5 days (10 kWh/day)
    summary = services.consumption_summary(
        household, meter, granularity="month",
        date_from=dt.date(2026, 6, 1), date_to=dt.date(2026, 7, 31),
    )
    assert summary["total_wh"] == 100_000
    assert len(summary["buckets"]) == 2
    june, july = summary["buckets"]
    assert june["total_wh"] == 50_000
    assert july["total_wh"] == 50_000
    assert june["estimated_wh"] == 50_000

    # hour view excludes daily estimates entirely (honesty rule)
    hourly = services.consumption_summary(
        household, meter, granularity="hour",
        date_from=dt.date(2026, 6, 26), date_to=dt.date(2026, 7, 6),
    )
    assert hourly["total_wh"] == 0
    assert hourly["buckets"] == []


def test_monotonicity_rejected():
    from rest_framework.exceptions import ValidationError
    household = HouseholdFactory()
    user = UserFactory()
    meter = ElectricityMeterFactory(household=household)
    services.create_meter_reading(
        household, user, meter=meter, register="base",
        reading_at=dt.datetime(2026, 6, 1, tzinfo=dt.timezone.utc), index_kwh=Decimal("500"),
    )
    with pytest.raises(ValidationError):
        services.create_meter_reading(
            household, user, meter=meter, register="base",
            reading_at=dt.datetime(2026, 6, 2, tzinfo=dt.timezone.utc), index_kwh=Decimal("400"),
        )


def test_dst_day_prorata():
    # DST spring forward in Europe/Paris: 2026-03-29 has 23 hours
    household = HouseholdFactory()
    user = UserFactory()
    meter = ElectricityMeterFactory(household=household, timezone="Europe/Paris")
    services.create_meter_reading(
        household, user, meter=meter, register="base",
        reading_at=dt.datetime(2026, 3, 28, 0, 0, tzinfo=PARIS), index_kwh=Decimal("100"),
    )
    services.create_meter_reading(
        household, user, meter=meter, register="base",
        reading_at=dt.datetime(2026, 3, 30, 0, 0, tzinfo=PARIS), index_kwh=Decimal("147"),
    )
    recs = list(ConsumptionRecord.objects.filter(meter=meter).order_by("ts_start"))
    assert len(recs) == 2
    total = sum(r.energy_wh for r in recs)
    assert total == 47_000
    # day 1 = 24h, day 2 (DST) = 23h -> 24/47 and 23/47 of the energy
    assert recs[0].energy_wh == round(47_000 * 24 / 47)
    assert recs[1].interval_minutes == 23 * 60
