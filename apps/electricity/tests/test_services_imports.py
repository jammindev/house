"""Import service tests — adapters, idempotence, source priority."""
import datetime as dt
import io
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from electricity import services
from electricity.models import ConsumptionRecord, ConsumptionSource, ImportStatus
from electricity.tests.factories import ElectricityMeterFactory, HouseholdFactory, UserFactory

pytestmark = pytest.mark.django_db

FIXTURE = Path(__file__).parent / "fixtures" / "enedis_courbe_de_charge.csv"
PARIS = ZoneInfo("Europe/Paris")


class FakeUpload(io.BytesIO):
    def __init__(self, content: bytes, name: str = "export.csv"):
        super().__init__(content)
        self.name = name


def _import(household, user, meter, content: bytes, **kwargs):
    return services.import_consumption_file(
        household, user, meter=meter, uploaded_file=FakeUpload(content), **kwargs
    )


def test_enedis_import_detects_converts_and_is_idempotent():
    household, user = HouseholdFactory(), UserFactory()
    meter = ElectricityMeterFactory(household=household, timezone="Europe/Paris")
    content = FIXTURE.read_bytes()

    imported = _import(household, user, meter, content)  # no provider: auto-detect
    assert imported.status == ImportStatus.COMPLETED
    assert imported.provider == "enedis_csv"
    assert imported.created_count == 5  # 6 rows, 1 measurement gap skipped
    assert imported.skipped_count == 0

    records = ConsumptionRecord.objects.filter(meter=meter).order_by("ts_start")
    assert records.count() == 5
    first = records.first()
    # Horodate marks the END of the interval: 00:30 local -> ts_start 00:00 local
    assert first.ts_start == dt.datetime(2026, 6, 1, 0, 0, tzinfo=PARIS)
    assert first.interval_minutes == 30
    assert first.energy_wh == 210  # 420 W over 30 min
    assert first.source == ConsumptionSource.IMPORT
    assert first.source_import_id == imported.id

    again = _import(household, user, meter, content)
    assert again.status == ImportStatus.COMPLETED
    assert again.created_count == 0
    assert again.skipped_count == 5
    assert ConsumptionRecord.objects.filter(meter=meter).count() == 5


def test_unreadable_line_fails_loudly_and_writes_nothing():
    household, user = HouseholdFactory(), UserFactory()
    meter = ElectricityMeterFactory(household=household)
    content = b"Horodate;Valeur\n2026-06-01T00:30:00+02:00;420\nnot-a-date;100\n"
    imported = _import(household, user, meter, content)
    assert imported.status == ImportStatus.FAILED
    assert "line 3" in imported.error
    assert ConsumptionRecord.objects.filter(meter=meter).count() == 0


def test_unknown_format_fails_with_trace():
    household, user = HouseholdFactory(), UserFactory()
    meter = ElectricityMeterFactory(household=household)
    imported = _import(household, user, meter, b"hello world\nnothing csv here\n")
    assert imported.status == ImportStatus.FAILED
    assert imported.provider == ""
    assert ConsumptionRecord.objects.count() == 0


def test_generic_csv_units_and_mapping():
    household, user = HouseholdFactory(), UserFactory()
    meter = ElectricityMeterFactory(household=household, timezone="Europe/Berlin")
    content = b"time,cons\n2026-06-01T00:00:00,1.5\n2026-06-01T00:15:00,2.0\n"
    options = {
        "timestamp_column": "time",
        "value_column": "cons",
        "unit": "kwh",
        "interval_minutes": 15,
    }
    imported = _import(household, user, meter, content, provider="generic_csv", options=options)
    assert imported.status == ImportStatus.COMPLETED
    assert imported.created_count == 2
    records = list(ConsumptionRecord.objects.filter(meter=meter).order_by("ts_start"))
    assert records[0].energy_wh == 1500
    assert records[0].interval_minutes == 15
    # naive timestamps localized in the meter timezone
    assert records[0].ts_start == dt.datetime(2026, 6, 1, 0, 0, tzinfo=ZoneInfo("Europe/Berlin"))

    # w_avg unit: 600 W over 15 min = 150 Wh
    content2 = b"time,cons\n2026-06-02T00:00:00,600\n"
    imported2 = _import(
        household, user, meter, content2, provider="generic_csv",
        options={**options, "unit": "w_avg"},
    )
    assert imported2.status == ImportStatus.COMPLETED
    rec = ConsumptionRecord.objects.filter(meter=meter, source_import=imported2).get()
    assert rec.energy_wh == 150

    # missing column -> failed with explicit message
    imported3 = _import(
        household, user, meter, content, provider="generic_csv",
        options={**options, "value_column": "nope"},
    )
    assert imported3.status == ImportStatus.FAILED
    assert "nope" in imported3.error


def test_import_days_take_priority_over_reading_estimates():
    household, user = HouseholdFactory(), UserFactory()
    meter = ElectricityMeterFactory(household=household, timezone="Europe/Paris")
    # readings spanning June 1 -> June 3 (2 estimated days of 5 kWh)
    services.create_meter_reading(
        household, user, meter=meter, register="base",
        reading_at=dt.datetime(2026, 6, 1, 0, 0, tzinfo=PARIS), index_kwh=Decimal("100"),
    )
    services.create_meter_reading(
        household, user, meter=meter, register="base",
        reading_at=dt.datetime(2026, 6, 3, 0, 0, tzinfo=PARIS), index_kwh=Decimal("110"),
    )
    # import covers June 1 only (2 half-hours of 500 Wh)
    content = (
        b"Horodate;Valeur\n"
        b"2026-06-01T10:30:00+02:00;1000\n"
        b"2026-06-01T11:00:00+02:00;1000\n"
    )
    imported = _import(household, user, meter, content)
    assert imported.status == ImportStatus.COMPLETED

    summary = services.consumption_summary(
        household, meter, granularity="day",
        date_from=dt.date(2026, 6, 1), date_to=dt.date(2026, 6, 3),
    )
    by_day = {b["ts"][:10]: b for b in summary["buckets"]}
    # June 1: import wins (1000 Wh), the 5000 Wh estimate is dropped
    assert by_day["2026-06-01"]["total_wh"] == 1000
    assert by_day["2026-06-01"]["estimated_wh"] == 0
    # June 2: no import that day -> the estimate stays
    assert by_day["2026-06-02"]["total_wh"] == 5000
    assert by_day["2026-06-02"]["estimated_wh"] == 5000
    assert summary["total_wh"] == 6000
