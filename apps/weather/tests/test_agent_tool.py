# weather/tests/test_agent_tool.py
"""Tests for the get_weather agent tool (parcours 17, Lot 5).

Covers registration + the handler's branches (not configured, module disabled,
forecast render, alerts line, upstream unavailable). The forecast is mocked — no
real Open-Meteo call.
"""
import pytest

from weather import agent as weather_agent
from weather import alerts as weather_alerts

from .factories import HouseholdFactory

pytestmark = pytest.mark.django_db


def _forecast(daily):
    return {
        "timezone": "Europe/Paris",
        "current": {
            "temperature": 12.0,
            "apparent_temperature": 10.0,
            "condition": "cloudy",
            "wind_speed": 15.0,
            "humidity": 70,
        },
        "daily": daily,
    }


def _day(date="2026-01-10", *, tmin=8.0, tmax=18.0, gust=10.0, code=1, precip=0):
    return {
        "date": date,
        "weather_code": code,
        "condition": "clear",
        "temp_max": tmax,
        "temp_min": tmin,
        "precipitation_probability_max": precip,
        "wind_gusts_max": gust,
        "sunrise": None,
        "sunset": None,
    }


def _call(household):
    return weather_agent._get_weather_handler(household=household, tool_input={}).rendered


# ── registration ─────────────────────────────────────────────────────────────

def test_tool_registered():
    from agent import tools

    assert weather_agent.GET_WEATHER in tools.REGISTRY
    schema = tools.REGISTRY[weather_agent.GET_WEATHER].to_schema()
    assert schema["name"] == "get_weather"
    assert "forecast" in schema["description"].lower()


# ── handler branches ─────────────────────────────────────────────────────────

def test_not_configured_no_location():
    hh = HouseholdFactory()  # no coords
    assert "not configured" in _call(hh)


def test_module_disabled():
    hh = HouseholdFactory(latitude=48.85, longitude=2.35, disabled_modules=["weather"])
    assert "not enabled" in _call(hh)


def test_renders_forecast(monkeypatch):
    from weather import services

    monkeypatch.setattr(services, "get_forecast", lambda lat, lon, **k: _forecast([_day()]))
    hh = HouseholdFactory(latitude=48.85, longitude=2.35, location_label="Paris")
    rendered = _call(hh)
    assert "Weather for Paris" in rendered
    assert "Current:" in rendered
    assert "7-day forecast:" in rendered
    assert "Active weather alerts: none." in rendered


def test_lists_active_alerts(monkeypatch):
    from weather import services

    monkeypatch.setattr(services, "get_forecast",
                        lambda lat, lon, **k: _forecast([_day(tmin=-4.0, tmax=38.0)]))
    hh = HouseholdFactory(latitude=48.85, longitude=2.35, location_label="Paris")
    rendered = _call(hh)
    assert "Active weather alerts:" in rendered
    assert "frost" in rendered and "heatwave" in rendered


def test_unavailable(monkeypatch):
    from weather import services

    def _raise(*a, **k):
        raise services.WeatherUnavailable("down")

    monkeypatch.setattr(services, "get_forecast", _raise)
    hh = HouseholdFactory(latitude=1.0, longitude=1.0, location_label="X")
    assert "temporarily unavailable" in _call(hh)
