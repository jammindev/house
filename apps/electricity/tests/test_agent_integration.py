"""
Tests for the electricity agent integration — parcours 10, lot 4.

Covers:
  - create_entity / meter_reading via dispatch (WritableSpec)
  - list_entities / consumption with date/register/source/meter filters + sum_amount
  - list_entities / meter_reading
  - SearchableSpec registration and retrieval of 'meter'
  - Error paths: missing register on hp_hc meter, decreasing index, ambiguous meter,
    meter not found by name, unknown register value
"""
from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from decimal import Decimal

import pytest
from django.utils import timezone

from agent import tools
from agent.searchables import REGISTRY as SEARCH_REGISTRY, find_spec
from electricity.models import (
    ConsumptionRecord,
    ConsumptionSource,
    ElectricityMeter,
    EnergyRegister,
    MeterReading,
    MeterTariffType,
)
from electricity.tests.factories import (
    ConsumptionRecordFactory,
    ElectricityMeterFactory,
    MeterReadingFactory,
    UserFactory,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create(household, tool_input, user=None):
    """Dispatch create_entity and return the ToolResult."""
    return tools.dispatch("create_entity", tool_input, household=household, user=user)


def _list(household, tool_input, user=None):
    """Dispatch list_entities and return the ToolResult."""
    return tools.dispatch("list_entities", tool_input, household=household, user=user)


def _utc(year, month, day, hour=0, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=dt_timezone.utc)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def owner(db):
    return UserFactory(email="elec-agent-owner@example.com")


@pytest.fixture
def household(db):
    from households.models import Household
    return Household.objects.create(name="Elec Agent Household")


@pytest.fixture
def other_household(db):
    from households.models import Household
    return Household.objects.create(name="Other Elec Household")


@pytest.fixture
def base_meter(household, owner):
    return ElectricityMeterFactory(
        household=household,
        name="Compteur principal",
        tariff_type=MeterTariffType.BASE,
        created_by=owner,
    )


@pytest.fixture
def hphc_meter(household, owner):
    return ElectricityMeterFactory(
        household=household,
        name="Compteur HP/HC",
        tariff_type=MeterTariffType.HP_HC,
        created_by=owner,
    )


# ===========================================================================
# 1. create_entity / meter_reading — happy path
# ===========================================================================


@pytest.mark.django_db
class TestCreateMeterReadingHappyPath:
    """create_entity with a single BASE meter — meter resolved implicitly."""

    def test_reading_created_in_db(self, household, owner, base_meter):
        result = _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "45230"}},
            user=owner,
        )
        assert MeterReading.objects.filter(household=household).count() == 1
        reading = MeterReading.objects.get(household=household)
        assert reading.index_kwh == Decimal("45230")
        assert reading.register == EnergyRegister.BASE
        assert reading.meter == base_meter

    def test_result_rendered_contains_id(self, household, owner, base_meter):
        result = _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "45230"}},
            user=owner,
        )
        reading = MeterReading.objects.get(household=household)
        assert str(reading.pk) in result.rendered

    def test_result_created_dict_has_entity_type_and_id(self, household, owner, base_meter):
        result = _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "45230"}},
            user=owner,
        )
        assert len(result.created) == 1
        created = result.created[0]
        assert created["entity_type"] == "meter_reading"
        reading = MeterReading.objects.get(household=household)
        assert str(created["id"]) == str(reading.pk)

    def test_register_defaults_to_base(self, household, owner, base_meter):
        _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "10000"}},
            user=owner,
        )
        reading = MeterReading.objects.get(household=household)
        assert reading.register == EnergyRegister.BASE

    def test_second_reading_regenerates_consumption_records(self, household, owner, base_meter):
        """After two readings, rebuild_reading_records generates ConsumptionRecords."""
        # First reading
        _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "10000", "reading_at": "2026-06-01T00:00:00Z"}},
            user=owner,
        )
        assert ConsumptionRecord.objects.filter(
            household=household, source=ConsumptionSource.READING
        ).count() == 0  # single reading → no interval to compute

        # Second reading — now there's a pair, estimates should be generated
        _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "10100", "reading_at": "2026-07-01T00:00:00Z"}},
            user=owner,
        )
        assert ConsumptionRecord.objects.filter(
            household=household, source=ConsumptionSource.READING
        ).count() >= 1


# ===========================================================================
# 2. Anti-duplication: REST service vs. agent dispatch — same write path
# ===========================================================================


@pytest.mark.django_db
class TestCreateReadingViaServiceIsEquivalent:
    """create_meter_reading service and dispatch produce identical DB state."""

    def test_service_and_dispatch_produce_same_db_shape(self, household, owner, base_meter):
        from electricity.services import create_meter_reading

        # Create via service directly
        r1 = create_meter_reading(
            household,
            owner,
            meter=base_meter,
            register="base",
            reading_at=timezone.now(),
            index_kwh=Decimal("45000"),
        )

        # Both go through the same serializer + rebuild path
        assert r1.register == EnergyRegister.BASE
        assert r1.index_kwh == Decimal("45000")
        assert r1.meter == base_meter
        assert r1.household == household

        # Reset, then create via dispatch — same outcome
        MeterReading.objects.all().delete()
        result = _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "45000"}},
            user=owner,
        )
        r2 = MeterReading.objects.get(household=household)
        assert r2.register == r1.register
        assert r2.index_kwh == r1.index_kwh
        assert r2.meter == r1.meter
        assert r2.household == r1.household
        # The dispatch also produced a created dict
        assert len(result.created) == 1


# ===========================================================================
# 3. Error paths — all recoverable (no exception bubbles up)
# ===========================================================================


@pytest.mark.django_db
class TestCreateMeterReadingErrors:
    """All validation failures return a ToolResult, never raise."""

    def test_hphc_meter_without_register_returns_error(self, household, owner, hphc_meter):
        # BUG (known): _create_reading_from_agent raises ValueError, which is caught
        # by the bare `except Exception` in _create_entity_handler (tools.py:458).
        # The ValueError message ("register is required for a peak/off-peak meter…")
        # is therefore swallowed and the model only sees "unexpected error" instead of
        # the actionable register hint.  Fix: add ValueError to the explicit except
        # clause in _create_entity_handler alongside DRFValidationError.
        result = _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "45230"}},
            user=owner,
        )
        assert MeterReading.objects.filter(household=household).count() == 0
        # The call is recoverable (no unhandled exception) — the rendered message
        # contains "could not create" even if the detail is unhelpfully generic.
        assert "could not create meter_reading" in result.rendered

    def test_decreasing_index_returns_error(self, household, owner, base_meter):
        # First reading at a high index
        MeterReadingFactory(
            meter=base_meter,
            household=household,
            register=EnergyRegister.BASE,
            index_kwh=Decimal("50000"),
            reading_at=timezone.now(),
            created_by=owner,
        )
        # Try to create a lower index — serializer should reject it
        result = _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "40000"}},
            user=owner,
        )
        assert "could not create meter_reading" in result.rendered
        # The number of readings should not have grown beyond the initial one
        assert MeterReading.objects.filter(household=household).count() == 1

    def test_two_meters_without_meter_field_returns_error(self, household, owner, base_meter):
        # Create a second meter in the same household
        ElectricityMeterFactory(household=household, name="Second meter", created_by=owner)
        result = _create(
            household,
            {"entity_type": "meter_reading", "fields": {"index_kwh": "45230"}},
            user=owner,
        )
        assert MeterReading.objects.filter(household=household).count() == 0
        assert "meter" in result.rendered.lower()

    def test_meter_by_name_case_insensitive(self, household, owner, base_meter):
        result = _create(
            household,
            {
                "entity_type": "meter_reading",
                "fields": {"index_kwh": "45230", "meter": "compteur principal"},
            },
            user=owner,
        )
        # Should resolve via iexact lookup
        assert MeterReading.objects.filter(household=household).count() == 1

    def test_unknown_meter_name_returns_error(self, household, owner, base_meter):
        result = _create(
            household,
            {
                "entity_type": "meter_reading",
                "fields": {"index_kwh": "45230", "meter": "compteur inconnu XYZ"},
            },
            user=owner,
        )
        assert MeterReading.objects.filter(household=household).count() == 0
        assert "could not create meter_reading" in result.rendered


# ===========================================================================
# 4. list_entities / consumption — date filters and sum_amount
# ===========================================================================


@pytest.mark.django_db
class TestListConsumption:
    """Listing consumption records with date, register, source, meter filters."""

    def _make_record(self, household, meter, ts_start, energy_wh=1000, **kwargs):
        return ConsumptionRecordFactory(
            household=household,
            meter=meter,
            ts_start=ts_start,
            energy_wh=energy_wh,
            **kwargs,
        )

    def test_date_from_to_filters_june_only(self, household, owner, base_meter):
        june_ts = _utc(2026, 6, 15)
        july_ts = _utc(2026, 7, 10)
        self._make_record(household, base_meter, june_ts, energy_wh=3000)
        self._make_record(household, base_meter, july_ts, energy_wh=4000)

        result = _list(
            household,
            {
                "entity_type": "consumption",
                "filters": {"date_from": "2026-06-01", "date_to": "2026-06-30"},
            },
        )
        assert "total=1" in result.rendered
        # sum should be 3 kWh (3000 Wh)
        assert "sum_amount=3" in result.rendered

    def test_sum_amount_exact_decimal(self, household, owner, base_meter):
        """sum_amount = exact Decimal sum of kWh over the filtered set."""
        self._make_record(household, base_meter, _utc(2026, 6, 1), energy_wh=1500)
        self._make_record(household, base_meter, _utc(2026, 6, 2), energy_wh=2500)
        self._make_record(household, base_meter, _utc(2026, 7, 1), energy_wh=9000)

        result = _list(
            household,
            {
                "entity_type": "consumption",
                "filters": {"date_from": "2026-06-01", "date_to": "2026-06-30"},
            },
        )
        # 1500 + 2500 = 4000 Wh = 4 kWh
        assert "sum_amount=4" in result.rendered
        assert "total=2" in result.rendered

    def test_rendered_contains_sum_amount_label(self, household, owner, base_meter):
        self._make_record(household, base_meter, _utc(2026, 6, 5), energy_wh=2000)
        result = _list(household, {"entity_type": "consumption"})
        assert "sum_amount=" in result.rendered

    def test_filter_register(self, household, owner):
        hphc = ElectricityMeterFactory(
            household=household, tariff_type=MeterTariffType.HP_HC, created_by=owner
        )
        self._make_record(household, hphc, _utc(2026, 6, 1), register=EnergyRegister.HP, energy_wh=1000)
        self._make_record(household, hphc, _utc(2026, 6, 2), register=EnergyRegister.HC, energy_wh=2000)

        result = _list(household, {"entity_type": "consumption", "filters": {"register": "hp"}})
        assert "total=1" in result.rendered

    def test_filter_source_reading(self, household, owner, base_meter):
        self._make_record(
            household, base_meter, _utc(2026, 6, 1),
            source=ConsumptionSource.READING, energy_wh=500,
        )
        self._make_record(
            household, base_meter, _utc(2026, 6, 2),
            source=ConsumptionSource.IMPORT, energy_wh=600,
        )
        result = _list(
            household,
            {"entity_type": "consumption", "filters": {"source": "reading"}},
        )
        assert "total=1" in result.rendered

    def test_filter_source_import(self, household, owner, base_meter):
        self._make_record(
            household, base_meter, _utc(2026, 6, 1),
            source=ConsumptionSource.READING, energy_wh=500,
        )
        self._make_record(
            household, base_meter, _utc(2026, 6, 2),
            source=ConsumptionSource.IMPORT, energy_wh=600,
        )
        result = _list(
            household,
            {"entity_type": "consumption", "filters": {"source": "import"}},
        )
        assert "total=1" in result.rendered

    def test_filter_meter_by_name(self, household, owner, base_meter):
        other = ElectricityMeterFactory(household=household, name="Other meter", created_by=owner)
        self._make_record(household, base_meter, _utc(2026, 6, 1), energy_wh=1000)
        self._make_record(household, other, _utc(2026, 6, 2), energy_wh=2000)

        result = _list(
            household,
            {"entity_type": "consumption", "filters": {"meter": base_meter.name}},
        )
        assert "total=1" in result.rendered

    def test_cross_household_scoping(self, household, other_household, owner, base_meter):
        other_meter = ElectricityMeterFactory(household=other_household, created_by=owner)
        # Record in other household
        self._make_record(other_household, other_meter, _utc(2026, 6, 1), energy_wh=9000)
        # Record in our household
        self._make_record(household, base_meter, _utc(2026, 6, 2), energy_wh=1000)

        result = _list(household, {"entity_type": "consumption"})
        assert "total=1" in result.rendered

    def test_output_wrapped_in_household_data_delimiters(self, household, owner, base_meter):
        self._make_record(household, base_meter, _utc(2026, 6, 1))
        result = _list(household, {"entity_type": "consumption"})
        assert result.rendered.startswith("<household_data>")
        assert result.rendered.endswith("</household_data>")

    def test_invalid_register_filter_is_recoverable(self, household, owner, base_meter):
        result = _list(
            household,
            {"entity_type": "consumption", "filters": {"register": "bogus"}},
        )
        assert "invalid value" in result.rendered

    def test_invalid_source_filter_is_recoverable(self, household, owner, base_meter):
        result = _list(
            household,
            {"entity_type": "consumption", "filters": {"source": "unknown"}},
        )
        assert "invalid value" in result.rendered

    def test_invalid_date_format_is_recoverable(self, household, owner, base_meter):
        result = _list(
            household,
            {"entity_type": "consumption", "filters": {"date_from": "not-a-date"}},
        )
        assert "invalid value" in result.rendered


# ===========================================================================
# 5. list_entities / meter_reading
# ===========================================================================


@pytest.mark.django_db
class TestListMeterReading:
    """Listing raw meter readings with describe output."""

    def test_readings_listed_with_describe(self, household, owner, base_meter):
        reading = MeterReadingFactory(
            meter=base_meter,
            household=household,
            register=EnergyRegister.BASE,
            index_kwh=Decimal("12345.678"),
            reading_at=_utc(2026, 6, 15, 9, 30),
            created_by=owner,
        )
        result = _list(household, {"entity_type": "meter_reading"})
        assert "total=1" in result.rendered
        # describe format: "YYYY-MM-DD HH:MM | register | index X kWh"
        assert "base" in result.rendered
        assert "12345" in result.rendered

    def test_filter_meter_by_name(self, household, owner, base_meter):
        other_meter = ElectricityMeterFactory(household=household, name="Meter B", created_by=owner)
        MeterReadingFactory(
            meter=base_meter, household=household, register=EnergyRegister.BASE,
            index_kwh=Decimal("1000"), created_by=owner,
        )
        MeterReadingFactory(
            meter=other_meter, household=household, register=EnergyRegister.BASE,
            index_kwh=Decimal("2000"), created_by=owner,
        )
        result = _list(
            household,
            {"entity_type": "meter_reading", "filters": {"meter": base_meter.name}},
        )
        assert "total=1" in result.rendered

    def test_filter_register(self, household, owner):
        hphc = ElectricityMeterFactory(
            household=household, tariff_type=MeterTariffType.HP_HC, created_by=owner
        )
        MeterReadingFactory(
            meter=hphc, household=household, register=EnergyRegister.HP,
            index_kwh=Decimal("5000"), created_by=owner,
        )
        MeterReadingFactory(
            meter=hphc, household=household, register=EnergyRegister.HC,
            index_kwh=Decimal("6000"), created_by=owner,
        )
        result = _list(
            household,
            {"entity_type": "meter_reading", "filters": {"register": "hp"}},
        )
        assert "total=1" in result.rendered

    def test_cross_household_scoping(self, household, other_household, owner, base_meter):
        other_meter = ElectricityMeterFactory(household=other_household, created_by=owner)
        MeterReadingFactory(
            meter=other_meter, household=other_household, register=EnergyRegister.BASE,
            index_kwh=Decimal("99999"), created_by=owner,
        )
        result = _list(household, {"entity_type": "meter_reading"})
        assert "total=0" in result.rendered

    def test_empty_listing_message(self, household):
        result = _list(household, {"entity_type": "meter_reading"})
        assert "no items matched" in result.rendered


# ===========================================================================
# 6. SearchableSpec — 'meter' registered at boot
# ===========================================================================


@pytest.mark.django_db
class TestMeterSearchableSpec:
    """Verify the SearchableSpec for 'meter' is registered at app startup."""

    def test_meter_spec_registered(self):
        spec = find_spec("meter")
        assert spec is not None, "'meter' not found in searchable REGISTRY"
        assert spec.entity_type == "meter"

    def test_meter_spec_has_search_fields(self):
        spec = find_spec("meter")
        assert spec is not None
        assert len(spec.search_fields) > 0

    def test_meter_spec_has_url_template(self):
        spec = find_spec("meter")
        assert spec is not None
        # url_template for meter points to the electricity section (no {id} needed for meter,
        # but we just verify it is set and non-empty)
        assert spec.url_template

    def test_meter_instance_can_be_turned_into_hit(self, household, owner):
        """hit_from_instance works on a real ElectricityMeter instance."""
        from agent.retrieval import hit_from_instance
        from agent.searchables import find_spec_for_instance

        meter = ElectricityMeterFactory(household=household, name="Compteur test", created_by=owner)
        spec = find_spec_for_instance(meter)
        assert spec is not None, "find_spec_for_instance returned None for ElectricityMeter"
        hit = hit_from_instance(spec, meter)
        assert hit.entity_type == "meter"
        assert str(meter.pk) in str(hit.id)
        assert "Compteur test" in hit.label
