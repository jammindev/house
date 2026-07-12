"""The monthly meter-reading ping: registration + due/skip logic per meter."""
from __future__ import annotations

from datetime import date, datetime, time, timezone as dt_timezone

import pytest
from django.utils import translation

from electricity.pings import build_meter_ping
from pings import registry

from .factories import ElectricityMeterFactory, HouseholdFactory, MeterReadingFactory, UserFactory

pytestmark = pytest.mark.django_db

TODAY = date(2026, 7, 12)
OLD = datetime(2026, 5, 20, 8, 0, tzinfo=dt_timezone.utc)
FRESH = datetime(2026, 7, 1, 8, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def household(db):
    return HouseholdFactory()


@pytest.fixture
def user(db):
    return UserFactory()


class TestMeterPingRegistration:
    def test_spec_is_registered_with_module_gating(self):
        spec = registry.find_spec("meter_reading")
        assert spec is not None
        assert spec.module == "electricity"
        assert spec.default_send_at == time(19, 0)


class TestBuildMeterPing:
    def test_skips_without_any_meter(self, household, user):
        assert build_meter_ping(household, user, today=TODAY) is None

    def test_skips_meter_that_never_had_a_reading(self, household, user):
        ElectricityMeterFactory(household=household, created_by=user)
        assert build_meter_ping(household, user, today=TODAY) is None

    def test_skips_while_latest_reading_is_fresh(self, household, user):
        meter = ElectricityMeterFactory(household=household, created_by=user)
        MeterReadingFactory(meter=meter, created_by=user, reading_at=FRESH)
        assert build_meter_ping(household, user, today=TODAY) is None

    def test_asks_when_the_latest_reading_is_a_month_old(self, household, user):
        meter = ElectricityMeterFactory(
            household=household, created_by=user, name="Linky"
        )
        MeterReadingFactory(
            meter=meter, created_by=user, reading_at=OLD, index_kwh="45230"
        )
        message = build_meter_ping(household, user, today=TODAY)
        assert message is not None
        assert "Linky" in message
        assert "45230" in message

    def test_skips_inactive_meters(self, household, user):
        meter = ElectricityMeterFactory(
            household=household, created_by=user, is_active=False
        )
        MeterReadingFactory(meter=meter, created_by=user, reading_at=OLD)
        assert build_meter_ping(household, user, today=TODAY) is None

    def test_lists_only_due_meters_when_several_exist(self, household, user):
        due = ElectricityMeterFactory(
            household=household, created_by=user, name="Garage"
        )
        fresh = ElectricityMeterFactory(
            household=household, created_by=user, name="Maison"
        )
        MeterReadingFactory(meter=due, created_by=user, reading_at=OLD)
        MeterReadingFactory(meter=fresh, created_by=user, reading_at=FRESH)
        message = build_meter_ping(household, user, today=TODAY)
        assert message is not None
        assert "Garage" in message
        assert "Maison" not in message

    def test_multi_meter_message_lists_each_due_meter(self, household, user):
        for name in ("Garage", "Atelier"):
            meter = ElectricityMeterFactory(
                household=household, created_by=user, name=name
            )
            MeterReadingFactory(meter=meter, created_by=user, reading_at=OLD)
        message = build_meter_ping(household, user, today=TODAY)
        assert message is not None
        assert "Garage" in message
        assert "Atelier" in message
        assert message.count("•") == 2

    def test_message_is_localized(self, household, user):
        meter = ElectricityMeterFactory(household=household, created_by=user)
        MeterReadingFactory(meter=meter, created_by=user, reading_at=OLD)
        with translation.override("fr"):
            message = build_meter_ping(household, user, today=TODAY)
        assert message is not None
        assert "relevé" in message
