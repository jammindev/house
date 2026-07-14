"""
Weather alert evaluation (parcours 17, Lot 4) — the single source of truth.

``evaluate_weather_alerts`` is **pure**: it reads the household forecast + fixed
thresholds and returns structured alerts. It writes nothing. The three delivery
channels all consume it, so the threshold logic lives in exactly one place:

- dashboard / alerts page → ``alerts.services.build_alerts_summary`` (on-read),
- Telegram ping → ``weather`` ``PingSpec('weather_alert')`` (scheduled, opt-in),
- in-app notification → created alongside the ping.

Thresholds are fixed defaults in V1 (no per-household config yet).
"""
from __future__ import annotations

import logging

from django.utils.translation import gettext as _

from . import services

logger = logging.getLogger(__name__)

# Fixed thresholds (V1). Tunable in one place; per-household config is V2.
FROST_MAX_TEMP_C = 0.0        # temp_min at or below → frost
HEAT_MIN_TEMP_C = 35.0        # temp_max at or above → heatwave
WIND_MIN_GUST_KMH = 50.0      # wind gusts at or above → strong wind
STORM_WMO_CODES = {95, 96, 99}

# How many days of the daily forecast to scan (today + tomorrow).
ALERT_WINDOW_DAYS = 2

# Alert kinds — stable slugs, mirrored by the frontend i18n (weather.alert.<kind>).
KIND_FROST = "frost"
KIND_HEATWAVE = "heatwave"
KIND_WIND = "wind"
KIND_STORM = "storm"


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def evaluate_weather_alerts(household) -> list[dict]:
    """Return the active weather alerts for ``household`` (may be empty).

    Each alert: ``{kind, severity, date, value, unit}``. Pure read — no writes,
    no network beyond the cached forecast. Returns ``[]`` when the household has
    no location or the forecast is unavailable (graceful, never raises).
    """
    if household is None or household.latitude is None or household.longitude is None:
        return []
    try:
        forecast = services.get_forecast(household.latitude, household.longitude)
    except services.WeatherUnavailable:
        return []

    alerts: list[dict] = []
    for day in (forecast.get("daily") or [])[:ALERT_WINDOW_DAYS]:
        date = day.get("date")
        temp_min = _num(day.get("temp_min"))
        temp_max = _num(day.get("temp_max"))
        gust = _num(day.get("wind_gusts_max"))
        code = day.get("weather_code")

        if temp_min is not None and temp_min <= FROST_MAX_TEMP_C:
            alerts.append({
                "kind": KIND_FROST,
                "severity": "critical" if temp_min <= -5 else "warning",
                "date": date,
                "value": round(temp_min),
                "unit": "°C",
            })
        if temp_max is not None and temp_max >= HEAT_MIN_TEMP_C:
            alerts.append({
                "kind": KIND_HEATWAVE,
                "severity": "critical" if temp_max >= 40 else "warning",
                "date": date,
                "value": round(temp_max),
                "unit": "°C",
            })
        if gust is not None and gust >= WIND_MIN_GUST_KMH:
            alerts.append({
                "kind": KIND_WIND,
                "severity": "critical" if gust >= 80 else "warning",
                "date": date,
                "value": round(gust),
                "unit": "km/h",
            })
        if code in STORM_WMO_CODES:
            alerts.append({
                "kind": KIND_STORM,
                "severity": "critical" if code in (96, 99) else "warning",
                "date": date,
                "value": None,
                "unit": None,
            })
    return alerts


# Emoji per kind — reused by the Telegram/notification rendering.
_EMOJI = {
    KIND_FROST: "❄️",
    KIND_HEATWAVE: "🥵",
    KIND_WIND: "💨",
    KIND_STORM: "⛈️",
}


def render_alert_line(alert: dict) -> str:
    """One localized line for an alert (Telegram / notification body).

    Called inside the user's language context (like pings), so ``gettext`` picks
    the right locale. The dashboard channel does NOT use this — it renders the
    structured fields client-side.
    """
    kind = alert.get("kind")
    value = alert.get("value")
    emoji = _EMOJI.get(kind, "🌡️")
    if kind == KIND_FROST:
        text = _("Frost expected: down to %(v)s°C") % {"v": value}
    elif kind == KIND_HEATWAVE:
        text = _("Heatwave: up to %(v)s°C") % {"v": value}
    elif kind == KIND_WIND:
        text = _("Strong wind: gusts up to %(v)s km/h") % {"v": value}
    elif kind == KIND_STORM:
        text = _("Thunderstorm expected")
    else:
        text = _("Weather alert")
    return f"{emoji} {text}"


def render_alert_message(alerts: list[dict]) -> str | None:
    """Build the full localized alert message (header + one line per alert), or
    ``None`` when there are no alerts. Deduplicates by kind so a two-day window
    with frost on both days yields a single frost line.
    """
    if not alerts:
        return None
    seen: set = set()
    lines: list[str] = []
    for alert in alerts:
        if alert["kind"] in seen:
            continue
        seen.add(alert["kind"])
        lines.append(render_alert_line(alert))
    header = _("⚠️ Weather alert for the days ahead:")
    return header + "\n" + "\n".join(lines)
