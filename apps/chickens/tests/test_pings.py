"""The evening egg ping: registration + skip conditions of build_message."""
from __future__ import annotations

from datetime import date, time

import pytest
from django.utils import translation

from chickens.models import Chicken
from chickens.pings import build_egg_ping
from pings import registry

from .factories import ChickenFactory, EggLogFactory, HouseholdFactory, UserFactory

pytestmark = pytest.mark.django_db

TODAY = date(2026, 7, 12)


@pytest.fixture
def household(db):
    return HouseholdFactory()


@pytest.fixture
def user(db):
    return UserFactory()


class TestEggPingRegistration:
    def test_spec_is_registered_with_module_gating(self):
        spec = registry.find_spec("egg_log")
        assert spec is not None
        assert spec.module == "chickens"
        assert spec.default_send_at == time(19, 0)


class TestBuildEggPing:
    def test_asks_when_flock_active_and_no_log_today(self, household, user):
        ChickenFactory(household=household, created_by=user)
        assert build_egg_ping(household, user, today=TODAY)

    def test_message_is_localized(self, household, user):
        ChickenFactory(household=household, created_by=user)
        with translation.override("fr"):
            assert "œufs" in build_egg_ping(household, user, today=TODAY)

    def test_skips_without_active_chickens(self, household, user):
        assert build_egg_ping(household, user, today=TODAY) is None

    def test_skips_when_flock_is_only_departed(self, household, user):
        ChickenFactory(household=household, created_by=user,
                       status=Chicken.Status.DECEASED)
        assert build_egg_ping(household, user, today=TODAY) is None

    def test_skips_when_today_already_logged(self, household, user):
        ChickenFactory(household=household, created_by=user)
        EggLogFactory(household=household, created_by=user, date=TODAY, count=5)
        assert build_egg_ping(household, user, today=TODAY) is None

    def test_yesterday_log_does_not_block_today(self, household, user):
        ChickenFactory(household=household, created_by=user)
        EggLogFactory(household=household, created_by=user,
                      date=date(2026, 7, 11), count=5)
        assert build_egg_ping(household, user, today=TODAY)
