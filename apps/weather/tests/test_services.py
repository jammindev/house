# weather/tests/test_services.py
"""Unit tests for weather.services — the single read path.

Covers:
  1. WMO code → condition slug mapping (incl. unknown fallback)
  2. geocode() normalization + empty query short-circuit
  3. get_forecast() normalization (current / today-only hourly / 7-day daily)
  4. caching (second call doesn't hit the network)
  5. WeatherUnavailable on transport error

All external HTTP is mocked — no real Open-Meteo call in the suite.
"""
import httpx
import pytest
from django.core.cache import cache

from weather import services


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


# ---------------------------------------------------------------------------
# WMO code mapping
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "code,expected",
    [
        (0, "clear"),
        (2, "partly_cloudy"),
        (3, "cloudy"),
        (45, "fog"),
        (51, "drizzle"),
        (65, "rain"),
        (75, "snow"),
        (95, "thunderstorm"),
        (999, "unknown"),
        (None, "unknown"),
        ("nope", "unknown"),
    ],
)
def test_condition_for_code(code, expected):
    assert services.condition_for_code(code) == expected


# ---------------------------------------------------------------------------
# geocode
# ---------------------------------------------------------------------------

def test_geocode_blank_query_short_circuits(monkeypatch):
    def _boom(*a, **k):  # pragma: no cover - must not be called
        raise AssertionError("network should not be hit for blank query")

    monkeypatch.setattr(services.httpx, "get", _boom)
    assert services.geocode("   ") == []


def test_geocode_normalizes_and_drops_coordless(monkeypatch):
    payload = {
        "results": [
            {
                "name": "Paris",
                "admin1": "Île-de-France",
                "country": "France",
                "country_code": "FR",
                "latitude": 48.85,
                "longitude": 2.35,
            },
            {"name": "NoCoords"},  # dropped — missing lat/lon
        ]
    }
    monkeypatch.setattr(services.httpx, "get", _fake_get(payload))

    results = services.geocode("Paris", language="fr")
    assert len(results) == 1
    assert results[0] == {
        "name": "Paris",
        "admin1": "Île-de-France",
        "country": "France",
        "country_code": "FR",
        "latitude": 48.85,
        "longitude": 2.35,
    }


# ---------------------------------------------------------------------------
# get_forecast
# ---------------------------------------------------------------------------

def test_get_forecast_normalizes_payload(monkeypatch):
    monkeypatch.setattr(services.httpx, "get", _fake_get(_FORECAST_PAYLOAD))

    fc = services.get_forecast(48.85, 2.35, use_cache=False)

    assert fc["timezone"] == "Europe/Paris"
    assert fc["units"]["temperature"] == "°C"
    assert fc["current"]["temperature"] == 12.3
    assert fc["current"]["condition"] == "cloudy"
    assert fc["current"]["is_day"] is True
    # hourly keeps only slots that fall on the current day (2 of 3)
    assert len(fc["hourly"]) == 2
    assert all(h["time"].startswith("2026-07-14") for h in fc["hourly"])
    # daily: both days, mapped conditions
    assert [d["date"] for d in fc["daily"]] == ["2026-07-14", "2026-07-15"]
    assert fc["daily"][1]["condition"] == "rain"
    assert fc["daily"][0]["temp_max"] == 20.0


def test_get_forecast_uses_cache(monkeypatch):
    calls = {"n": 0}

    def _counting_get(url, params=None, timeout=None):
        calls["n"] += 1
        return _FakeResponse(_FORECAST_PAYLOAD)

    monkeypatch.setattr(services.httpx, "get", _counting_get)

    services.get_forecast(48.85, 2.35)
    services.get_forecast(48.85, 2.35)  # served from cache
    assert calls["n"] == 1


def test_get_forecast_raises_on_transport_error(monkeypatch):
    def _raise(*a, **k):
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(services.httpx, "get", _raise)
    with pytest.raises(services.WeatherUnavailable):
        services.get_forecast(48.85, 2.35, use_cache=False)


# ---------------------------------------------------------------------------
# get_history (Lot 6)
# ---------------------------------------------------------------------------

_ARCHIVE_PAYLOAD = {
    "daily": {
        "time": ["2026-01-01", "2026-01-02", "2026-01-03"],
        "temperature_2m_mean": [0.5, None, 3.3],
    }
}


def test_get_history_normalizes_and_drops_nulls(monkeypatch):
    monkeypatch.setattr(services.httpx, "get", _fake_get(_ARCHIVE_PAYLOAD))
    points = services.get_history(48.85, 2.35, "2026-01-01", "2026-01-03", use_cache=False)
    # The None day is dropped.
    assert points == [
        {"date": "2026-01-01", "temp_mean": 0.5},
        {"date": "2026-01-03", "temp_mean": 3.3},
    ]


def test_get_history_uses_cache(monkeypatch):
    calls = {"n": 0}

    def _counting_get(url, params=None, timeout=None):
        calls["n"] += 1
        return _FakeResponse(_ARCHIVE_PAYLOAD)

    monkeypatch.setattr(services.httpx, "get", _counting_get)
    services.get_history(48.85, 2.35, "2026-01-01", "2026-01-03")
    services.get_history(48.85, 2.35, "2026-01-01", "2026-01-03")
    assert calls["n"] == 1


def test_get_history_raises_on_transport_error(monkeypatch):
    def _raise(*a, **k):
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(services.httpx, "get", _raise)
    with pytest.raises(services.WeatherUnavailable):
        services.get_history(48.85, 2.35, "2026-01-01", "2026-01-03", use_cache=False)


# ---------------------------------------------------------------------------
# Helpers / fixtures data
# ---------------------------------------------------------------------------

class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=None, response=None)

    def json(self):
        return self._payload


def _fake_get(payload):
    def _get(url, params=None, timeout=None):
        return _FakeResponse(payload)

    return _get


_FORECAST_PAYLOAD = {
    "timezone": "Europe/Paris",
    "current_units": {"temperature_2m": "°C", "wind_speed_10m": "km/h"},
    "current": {
        "time": "2026-07-14T10:00",
        "temperature_2m": 12.3,
        "apparent_temperature": 10.1,
        "relative_humidity_2m": 78,
        "weather_code": 3,
        "wind_speed_10m": 15.0,
        "is_day": 1,
    },
    "hourly": {
        "time": ["2026-07-14T09:00", "2026-07-14T10:00", "2026-07-15T00:00"],
        "temperature_2m": [11.0, 12.3, 9.0],
        "precipitation_probability": [10, 20, 0],
        "weather_code": [3, 3, 61],
    },
    "daily": {
        "time": ["2026-07-14", "2026-07-15"],
        "weather_code": [3, 61],
        "temperature_2m_max": [20.0, 18.0],
        "temperature_2m_min": [12.0, 11.0],
        "precipitation_probability_max": [20, 80],
        "sunrise": ["2026-07-14T06:02", "2026-07-15T06:03"],
        "sunset": ["2026-07-14T21:50", "2026-07-15T21:49"],
    },
}
