"""
Weather service — the single read path for the weather module (parcours 17).

This module has **no household-scoped model**: it reads forecasts live from
Open-Meteo (free, no API key) and caches them. Both the REST viewset and any
future consumer call these functions — never Open-Meteo directly.

Design contract:
- Network / API errors are logged and surfaced as ``WeatherUnavailable`` — never
  propagated as a 500. The viewset turns that into a graceful "error" state.
- The raw WMO ``weather_code`` is mapped to a stable ``condition`` slug so the
  frontend owns the i18n label + emoji (no localisation leaks into the backend).
- Results are cached in the Django cache keyed by rounded coordinates, so a
  render storm hits Open-Meteo at most once per ``CACHE_TTL_SECONDS``.
"""
from __future__ import annotations

import logging

import httpx
from django.core.cache import cache

logger = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
REQUEST_TIMEOUT_SECONDS = 8.0
CACHE_TTL_SECONDS = 30 * 60  # 30 min — forecasts don't move faster than that
FORECAST_DAYS = 7

# WMO weather interpretation codes → stable condition slug. The frontend maps
# each slug to an emoji + a translated label (``weather.condition.<slug>``).
# https://open-meteo.com/en/docs#weathervariables
_CONDITION_BY_CODE = {
    0: "clear",
    1: "partly_cloudy",
    2: "partly_cloudy",
    3: "cloudy",
    45: "fog",
    48: "fog",
    51: "drizzle",
    53: "drizzle",
    55: "drizzle",
    56: "drizzle",
    57: "drizzle",
    61: "rain",
    63: "rain",
    65: "rain",
    66: "rain",
    67: "rain",
    80: "rain",
    81: "rain",
    82: "rain",
    71: "snow",
    73: "snow",
    75: "snow",
    77: "snow",
    85: "snow",
    86: "snow",
    95: "thunderstorm",
    96: "thunderstorm",
    99: "thunderstorm",
}


class WeatherUnavailable(Exception):
    """Raised when Open-Meteo can't be reached or returns garbage."""


def condition_for_code(code) -> str:
    """Map a WMO weather code to a condition slug (``unknown`` fallback)."""
    try:
        return _CONDITION_BY_CODE.get(int(code), "unknown")
    except (TypeError, ValueError):
        return "unknown"


def _get_json(url: str, params: dict) -> dict:
    try:
        response = httpx.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:  # network, status, or bad JSON
        logger.warning("Open-Meteo request failed (%s): %s", url, exc)
        raise WeatherUnavailable(str(exc)) from exc


def geocode(query: str, *, language: str = "en", count: int = 5) -> list[dict]:
    """Resolve a place name to candidate coordinates via Open-Meteo geocoding.

    Returns a list (possibly empty) of ``{name, admin1, country, country_code,
    latitude, longitude}``. Raises :class:`WeatherUnavailable` on transport error.
    """
    query = (query or "").strip()
    if not query:
        return []

    data = _get_json(
        GEOCODING_URL,
        {"name": query, "count": count, "language": language, "format": "json"},
    )
    results = data.get("results") or []
    return [
        {
            "name": r.get("name") or "",
            "admin1": r.get("admin1") or "",
            "country": r.get("country") or "",
            "country_code": r.get("country_code") or "",
            "latitude": r.get("latitude"),
            "longitude": r.get("longitude"),
        }
        for r in results
        if r.get("latitude") is not None and r.get("longitude") is not None
    ]


def _cache_key(latitude: float, longitude: float) -> str:
    # Round to ~1 km — nearby renders share a cache entry.
    return f"weather:forecast:{round(latitude, 2)}:{round(longitude, 2)}"


def get_forecast(latitude: float, longitude: float, *, use_cache: bool = True) -> dict:
    """Fetch + normalize current conditions, today's hourly, and a 7-day daily
    forecast for a coordinate. Cached ~30 min. Raises
    :class:`WeatherUnavailable` on transport error (and no cache hit).
    """
    key = _cache_key(latitude, longitude)
    if use_cache:
        cached = cache.get(key)
        if cached is not None:
            return cached

    raw = _get_json(
        FORECAST_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "timezone": "auto",
            "forecast_days": FORECAST_DAYS,
            "current": ",".join([
                "temperature_2m",
                "apparent_temperature",
                "relative_humidity_2m",
                "weather_code",
                "wind_speed_10m",
                "is_day",
            ]),
            "hourly": ",".join([
                "temperature_2m",
                "precipitation_probability",
                "weather_code",
            ]),
            "daily": ",".join([
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_probability_max",
                "wind_gusts_10m_max",
                "sunrise",
                "sunset",
            ]),
        },
    )
    normalized = _normalize_forecast(raw)
    if use_cache:
        cache.set(key, normalized, CACHE_TTL_SECONDS)
    return normalized


def _normalize_forecast(raw: dict) -> dict:
    """Flatten Open-Meteo's parallel-arrays payload into the shape the frontend
    consumes: a ``current`` object, an ``hourly`` list (today only), and a
    ``daily`` list of up to 7 days.
    """
    cur = raw.get("current") or {}
    current = {
        "time": cur.get("time"),
        "temperature": cur.get("temperature_2m"),
        "apparent_temperature": cur.get("apparent_temperature"),
        "humidity": cur.get("relative_humidity_2m"),
        "wind_speed": cur.get("wind_speed_10m"),
        "weather_code": cur.get("weather_code"),
        "condition": condition_for_code(cur.get("weather_code")),
        "is_day": bool(cur.get("is_day", 1)),
    }

    hourly_src = raw.get("hourly") or {}
    times = hourly_src.get("time") or []
    temps = hourly_src.get("temperature_2m") or []
    precip = hourly_src.get("precipitation_probability") or []
    codes = hourly_src.get("weather_code") or []
    # Keep only today's slots (Open-Meteo returns full days per FORECAST_DAYS).
    today = (current.get("time") or "")[:10]
    hourly = [
        {
            "time": times[i],
            "temperature": temps[i] if i < len(temps) else None,
            "precipitation_probability": precip[i] if i < len(precip) else None,
            "weather_code": codes[i] if i < len(codes) else None,
            "condition": condition_for_code(codes[i]) if i < len(codes) else "unknown",
        }
        for i in range(len(times))
        if str(times[i]).startswith(today)
    ]

    daily_src = raw.get("daily") or {}
    d_dates = daily_src.get("time") or []
    d_codes = daily_src.get("weather_code") or []
    d_max = daily_src.get("temperature_2m_max") or []
    d_min = daily_src.get("temperature_2m_min") or []
    d_precip = daily_src.get("precipitation_probability_max") or []
    d_wind = daily_src.get("wind_gusts_10m_max") or []
    d_sunrise = daily_src.get("sunrise") or []
    d_sunset = daily_src.get("sunset") or []
    daily = [
        {
            "date": d_dates[i],
            "weather_code": d_codes[i] if i < len(d_codes) else None,
            "condition": condition_for_code(d_codes[i]) if i < len(d_codes) else "unknown",
            "temp_max": d_max[i] if i < len(d_max) else None,
            "temp_min": d_min[i] if i < len(d_min) else None,
            "precipitation_probability_max": d_precip[i] if i < len(d_precip) else None,
            "wind_gusts_max": d_wind[i] if i < len(d_wind) else None,
            "sunrise": d_sunrise[i] if i < len(d_sunrise) else None,
            "sunset": d_sunset[i] if i < len(d_sunset) else None,
        }
        for i in range(len(d_dates))
    ]

    units = raw.get("current_units") or {}
    return {
        "timezone": raw.get("timezone") or "",
        "units": {
            "temperature": units.get("temperature_2m", "°C"),
            "wind_speed": units.get("wind_speed_10m", "km/h"),
        },
        "current": current,
        "hourly": hourly,
        "daily": daily,
    }
