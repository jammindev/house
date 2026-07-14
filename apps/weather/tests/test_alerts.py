# weather/tests/test_alerts.py
"""Tests for weather alerts (parcours 17, Lot 4).

Covers the shared evaluator, its three consumers, and the anti-spam guards:
  1. evaluate_weather_alerts — each threshold type, window, no-location
  2. render_alert_message — dedup by kind, None when empty
  3. build_weather_alert_ping — text + bell notification, idempotent, None-skip
  4. alerts.build_alerts_summary — weather category + disabled-module gating

The forecast is always mocked — no real Open-Meteo call.
"""
import pytest

from weather import alerts as weather_alerts

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory

pytestmark = pytest.mark.django_db


def _forecast(daily):
    return {"timezone": "Europe/Paris", "units": {}, "current": {}, "hourly": [], "daily": daily}


def _day(date="2026-01-10", *, tmin=8.0, tmax=18.0, gust=10.0, code=1):
    return {
        "date": date,
        "weather_code": code,
        "condition": "clear",
        "temp_max": tmax,
        "temp_min": tmin,
        "precipitation_probability_max": 0,
        "wind_gusts_max": gust,
        "sunrise": None,
        "sunset": None,
    }


def _household_at(monkeypatch, daily):
    hh = HouseholdFactory(latitude=48.85, longitude=2.35)
    monkeypatch.setattr(weather_alerts.services, "get_forecast", lambda lat, lon, **k: _forecast(daily))
    return hh


# ── evaluator ──────────────────────────────────────────────────────────────

def test_no_location_returns_empty(monkeypatch):
    hh = HouseholdFactory()  # no coords
    monkeypatch.setattr(weather_alerts.services, "get_forecast",
                        lambda *a, **k: pytest.fail("should not fetch"))
    assert weather_alerts.evaluate_weather_alerts(hh) == []


def test_calm_weather_no_alerts(monkeypatch):
    hh = _household_at(monkeypatch, [_day(), _day(date="2026-01-11")])
    assert weather_alerts.evaluate_weather_alerts(hh) == []


def test_frost_detected(monkeypatch):
    hh = _household_at(monkeypatch, [_day(tmin=-3.0)])
    result = weather_alerts.evaluate_weather_alerts(hh)
    assert len(result) == 1
    assert result[0]["kind"] == "frost"
    assert result[0]["value"] == -3
    assert result[0]["severity"] == "warning"  # -3 > -5


def test_severe_frost_is_critical(monkeypatch):
    hh = _household_at(monkeypatch, [_day(tmin=-8.0)])
    assert weather_alerts.evaluate_weather_alerts(hh)[0]["severity"] == "critical"


def test_heatwave_wind_storm(monkeypatch):
    hh = _household_at(monkeypatch, [_day(tmax=37.0, gust=60.0, code=95)])
    kinds = {a["kind"] for a in weather_alerts.evaluate_weather_alerts(hh)}
    assert kinds == {"heatwave", "wind", "storm"}


def test_window_limited_to_two_days(monkeypatch):
    # Frost only on day 3 → outside the 2-day window → ignored.
    daily = [_day(), _day(date="2026-01-11"), _day(date="2026-01-12", tmin=-5.0)]
    hh = _household_at(monkeypatch, daily)
    assert weather_alerts.evaluate_weather_alerts(hh) == []


def test_unavailable_forecast_returns_empty(monkeypatch):
    hh = HouseholdFactory(latitude=1.0, longitude=1.0)

    def _raise(*a, **k):
        raise weather_alerts.services.WeatherUnavailable("down")

    monkeypatch.setattr(weather_alerts.services, "get_forecast", _raise)
    assert weather_alerts.evaluate_weather_alerts(hh) == []


# ── rendering ──────────────────────────────────────────────────────────────

def test_render_none_when_empty():
    assert weather_alerts.render_alert_message([]) is None


def test_render_dedupes_by_kind():
    alerts = [
        {"kind": "frost", "severity": "warning", "date": "d1", "value": -1, "unit": "°C"},
        {"kind": "frost", "severity": "warning", "date": "d2", "value": -2, "unit": "°C"},
    ]
    msg = weather_alerts.render_alert_message(alerts)
    assert msg.count("❄️") == 1  # a single frost line despite two frost days


# ── ping + notification ──────────────────────────────────────────────────────

def _member(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user)
    return user


def test_ping_none_when_no_alert(monkeypatch):
    from datetime import date

    from weather.pings import build_weather_alert_ping

    hh = _household_at(monkeypatch, [_day()])
    user = _member(hh)
    assert build_weather_alert_ping(hh, user, today=date(2026, 1, 10)) is None


def test_ping_returns_text_and_creates_notification(monkeypatch):
    from datetime import date

    from notifications.models import Notification
    from weather.pings import build_weather_alert_ping, NOTIFICATION_TYPE

    hh = _household_at(monkeypatch, [_day(tmin=-4.0)])
    user = _member(hh)

    msg = build_weather_alert_ping(hh, user, today=date(2026, 1, 10))
    assert msg is not None and "❄️" in msg
    notifs = Notification.objects.filter(user=user, type=NOTIFICATION_TYPE)
    assert notifs.count() == 1


def test_ping_notification_idempotent_same_day(monkeypatch):
    from datetime import date

    from notifications.models import Notification
    from weather.pings import build_weather_alert_ping, NOTIFICATION_TYPE

    hh = _household_at(monkeypatch, [_day(tmin=-4.0)])
    user = _member(hh)
    today = date(2026, 1, 10)

    build_weather_alert_ping(hh, user, today=today)
    build_weather_alert_ping(hh, user, today=today)  # retry same day
    assert Notification.objects.filter(user=user, type=NOTIFICATION_TYPE).count() == 1


# ── dashboard summary integration ────────────────────────────────────────────

def test_summary_includes_weather_category(monkeypatch):
    from alerts.services import build_alerts_summary

    hh = HouseholdFactory(latitude=48.85, longitude=2.35)
    monkeypatch.setattr(weather_alerts.services, "get_forecast",
                        lambda *a, **k: _forecast([_day(tmax=38.0)]))
    summary = build_alerts_summary(hh)
    assert len(summary["weather_alerts"]) == 1
    assert summary["weather_alerts"][0]["kind"] == "heatwave"
    assert summary["total"] >= 1


def test_summary_excludes_weather_when_module_disabled(monkeypatch):
    from alerts.services import build_alerts_summary

    hh = HouseholdFactory(latitude=48.85, longitude=2.35, disabled_modules=["weather"])
    monkeypatch.setattr(weather_alerts.services, "get_forecast",
                        lambda *a, **k: pytest.fail("should not fetch when module disabled"))
    summary = build_alerts_summary(hh)
    assert summary["weather_alerts"] == []
