"""Preferences REST API: list merged with defaults, upsert, gating, auth."""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from pings.models import PingPreference

from .conftest import PING_TYPE

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestPingList:
    def test_lists_available_pings_with_defaults(self, api_client, ping_spec):
        response = api_client.get("/api/pings/")
        assert response.status_code == 200
        row = next(r for r in response.data if r["ping_type"] == PING_TYPE)
        assert row["enabled"] is False
        assert row["send_at"] == "19:00"

    def test_requires_authentication(self, ping_spec, db):
        assert APIClient().get("/api/pings/").status_code in (401, 403)


class TestPingUpdate:
    def test_enables_a_ping(self, api_client, household, user, ping_spec):
        response = api_client.put(
            f"/api/pings/{PING_TYPE}/", {"enabled": True, "send_at": "20:30"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["enabled"] is True
        assert response.data["send_at"] == "20:30"

        pref = PingPreference.objects.get(household=household, user=user)
        assert pref.enabled is True
        assert pref.send_at.strftime("%H:%M") == "20:30"

    def test_toggle_without_time_keeps_default(self, api_client, ping_spec):
        response = api_client.put(
            f"/api/pings/{PING_TYPE}/", {"enabled": True}, format="json"
        )
        assert response.status_code == 200
        assert response.data["send_at"] == "19:00"

    def test_unknown_ping_type_404(self, api_client, ping_spec):
        response = api_client.put(
            "/api/pings/nope/", {"enabled": True}, format="json"
        )
        assert response.status_code == 404

    def test_invalid_time_400(self, api_client, ping_spec):
        response = api_client.put(
            f"/api/pings/{PING_TYPE}/", {"enabled": True, "send_at": "quarante"},
            format="json",
        )
        assert response.status_code == 400

    def test_preferences_are_per_user(self, api_client, household, user, ping_spec):
        from accounts.tests.factories import UserFactory
        from households.models import HouseholdMember

        api_client.put(f"/api/pings/{PING_TYPE}/", {"enabled": True}, format="json")

        other = UserFactory(email="other-view@example.com")
        HouseholdMember.objects.create(
            user=other, household=household, role=HouseholdMember.Role.MEMBER
        )
        other.active_household = household
        other.save(update_fields=["active_household"])
        other_client = APIClient()
        other_client.force_authenticate(user=other)

        response = other_client.get("/api/pings/")
        row = next(r for r in response.data if r["ping_type"] == PING_TYPE)
        assert row["enabled"] is False  # the first user's opt-in is not shared
