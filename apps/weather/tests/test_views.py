# weather/tests/test_views.py
"""API view tests for the weather app.

Covers:
  1. WeatherView — not configured (no coords) → configured:false, no network
  2. WeatherView — configured → forecast merged with household location
  3. WeatherView — Open-Meteo down → error:true (graceful, still HTTP 200)
  4. WeatherView — unauthenticated → 401
  5. Geocode view — proxies results / error state

Auth pattern mirrors water: force_authenticate + user.active_household set so
ActiveHouseholdMiddleware resolves request.household.
"""
import httpx
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from households.models import HouseholdMember
from weather import services

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory

pytestmark = pytest.mark.django_db

WEATHER_URL = "/api/weather/"
GEOCODE_URL = "/api/weather/geocode/"
HISTORY_URL = "/api/weather/history/"


def _member_of(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_weather_unauthenticated_401():
    resp = APIClient().get(WEATHER_URL)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_weather_not_configured(monkeypatch):
    household = HouseholdFactory()  # no coords
    user = _member_of(household)

    def _boom(*a, **k):  # pragma: no cover
        raise AssertionError("no network when location is unset")

    monkeypatch.setattr(services, "get_forecast", _boom)

    resp = _client_for(user).get(WEATHER_URL)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data == {"configured": False}


def test_weather_configured_returns_forecast(monkeypatch):
    household = HouseholdFactory(latitude=48.85, longitude=2.35, location_label="Paris, France")
    user = _member_of(household)

    fake_forecast = {
        "timezone": "Europe/Paris",
        "units": {"temperature": "°C", "wind_speed": "km/h"},
        "current": {"temperature": 12.3, "condition": "cloudy", "is_day": True},
        "hourly": [],
        "daily": [],
    }
    monkeypatch.setattr(services, "get_forecast", lambda lat, lon: fake_forecast)

    resp = _client_for(user).get(WEATHER_URL)
    assert resp.status_code == status.HTTP_200_OK
    body = resp.data
    assert body["configured"] is True
    assert body["error"] is False
    assert body["location_label"] == "Paris, France"
    assert body["latitude"] == 48.85
    assert body["current"]["condition"] == "cloudy"
    assert body["timezone"] == "Europe/Paris"


def test_weather_upstream_down_returns_error(monkeypatch):
    household = HouseholdFactory(latitude=48.85, longitude=2.35, location_label="Paris")
    user = _member_of(household)

    def _raise(lat, lon):
        raise services.WeatherUnavailable("down")

    monkeypatch.setattr(services, "get_forecast", _raise)

    resp = _client_for(user).get(WEATHER_URL)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["configured"] is True
    assert resp.data["error"] is True


def test_geocode_proxies_results(monkeypatch):
    user = _member_of(HouseholdFactory())
    results = [{"name": "Paris", "latitude": 48.85, "longitude": 2.35}]
    monkeypatch.setattr(services, "geocode", lambda q, language="en": results)

    resp = _client_for(user).get(GEOCODE_URL, {"q": "Paris"})
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["error"] is False
    assert resp.data["results"] == results


def test_geocode_error_state(monkeypatch):
    user = _member_of(HouseholdFactory())

    def _raise(q, language="en"):
        raise services.WeatherUnavailable("down")

    monkeypatch.setattr(services, "geocode", _raise)

    resp = _client_for(user).get(GEOCODE_URL, {"q": "Paris"})
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["results"] == []
    assert resp.data["error"] is True


# ── history (Lot 6) ──────────────────────────────────────────────────────────

def test_history_not_configured(monkeypatch):
    user = _member_of(HouseholdFactory())  # no coords
    monkeypatch.setattr(services, "get_history", lambda *a, **k: pytest.fail("no fetch"))
    resp = _client_for(user).get(HISTORY_URL, {"date_from": "2026-01-01", "date_to": "2026-01-10"})
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data == {"configured": False, "points": []}


def test_history_returns_points(monkeypatch):
    user = _member_of(HouseholdFactory(latitude=48.85, longitude=2.35))
    pts = [{"date": "2026-01-01", "temp_mean": 0.5}]
    monkeypatch.setattr(services, "get_history", lambda lat, lon, df, dt: pts)
    resp = _client_for(user).get(HISTORY_URL, {"date_from": "2026-01-01", "date_to": "2026-01-10"})
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data == {"configured": True, "error": False, "points": pts}


def test_history_bad_dates(monkeypatch):
    user = _member_of(HouseholdFactory(latitude=1.0, longitude=1.0))
    resp = _client_for(user).get(HISTORY_URL, {"date_from": "nope", "date_to": "2026-01-10"})
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_history_upstream_error(monkeypatch):
    user = _member_of(HouseholdFactory(latitude=1.0, longitude=1.0))

    def _raise(lat, lon, df, dt):
        raise services.WeatherUnavailable("down")

    monkeypatch.setattr(services, "get_history", _raise)
    resp = _client_for(user).get(HISTORY_URL, {"date_from": "2026-01-01", "date_to": "2026-01-10"})
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["error"] is True
    assert resp.data["points"] == []
