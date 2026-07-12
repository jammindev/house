"""The monthly water-reading ping: registration + skip conditions."""
from __future__ import annotations

from datetime import date, time

import pytest
from django.utils import translation

from pings import registry
from water.pings import REMINDER_INTERVAL_DAYS, build_water_ping

from .factories import HouseholdFactory, UserFactory, WaterReadingFactory

pytestmark = pytest.mark.django_db

TODAY = date(2026, 7, 12)


@pytest.fixture
def household(db):
    return HouseholdFactory()


@pytest.fixture
def user(db):
    return UserFactory()


class TestWaterPingRegistration:
    def test_spec_is_registered_with_module_gating(self):
        spec = registry.find_spec("water_reading")
        assert spec is not None
        assert spec.module == "water"
        assert spec.default_send_at == time(19, 0)


class TestBuildWaterPing:
    def test_skips_when_household_never_logged_a_reading(self, household, user):
        assert build_water_ping(household, user, today=TODAY) is None

    def test_skips_while_latest_reading_is_fresh(self, household, user):
        WaterReadingFactory(
            household=household, created_by=user, reading_date=date(2026, 7, 1)
        )
        assert build_water_ping(household, user, today=TODAY) is None

    def test_asks_once_the_latest_reading_turns_a_month_old(self, household, user):
        WaterReadingFactory(
            household=household,
            created_by=user,
            reading_date=date(2026, 6, 12),
            index_m3="1234.5",
        )
        message = build_water_ping(household, user, today=TODAY)
        assert message is not None
        assert "1234.5" in message

    def test_reading_exactly_interval_days_old_is_due(self, household, user):
        assert REMINDER_INTERVAL_DAYS == 30
        WaterReadingFactory(
            household=household, created_by=user, reading_date=date(2026, 6, 12)
        )
        assert build_water_ping(household, user, today=TODAY) is not None

    def test_reading_one_day_fresher_than_interval_is_not_due(self, household, user):
        WaterReadingFactory(
            household=household, created_by=user, reading_date=date(2026, 6, 13)
        )
        assert build_water_ping(household, user, today=TODAY) is None

    def test_only_the_latest_reading_counts(self, household, user):
        WaterReadingFactory(
            household=household, created_by=user, reading_date=date(2026, 1, 5)
        )
        WaterReadingFactory(
            household=household, created_by=user, reading_date=date(2026, 7, 10)
        )
        assert build_water_ping(household, user, today=TODAY) is None

    def test_message_is_localized(self, household, user):
        WaterReadingFactory(
            household=household, created_by=user, reading_date=date(2026, 5, 1)
        )
        with translation.override("fr"):
            message = build_water_ping(household, user, today=TODAY)
        assert message is not None
        assert "relevé" in message
