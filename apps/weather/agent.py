"""
Weather agent tool (parcours 17, Lot 5) — ``get_weather``.

The weather module has no household-scoped model, so it cannot ride the
``searchables`` registry (which indexes DB rows). Instead it exposes a dedicated
read-only agent tool, registered from ``weather/apps.py::ready()`` via
``agent.tools.register`` — the same "declare from the owning app, never touch
apps/agent/" pattern the other apps use for writables/listables.

The tool result is rendered as neutral data (English labels + numbers); the model
phrases the final answer in the user's language, exactly like search results.
"""
from __future__ import annotations

from typing import Any

from agent.tools import AgentTool, ToolResult

GET_WEATHER = "get_weather"

_GET_WEATHER_SCHEMA = {
    "type": "object",
    "properties": {},
    "required": [],
}

_GET_WEATHER_DESCRIPTION = (
    "Get the local weather for this household: current conditions, a 7-day "
    "forecast (min/max temperature, rain probability), and any active weather "
    "alerts (frost, heatwave, strong wind, storm). Call this for ANY question "
    "about the weather, forecast, temperature, rain, wind, sun, or whether the "
    "conditions suit an outdoor activity (mowing, painting, a walk). Returns a "
    "note that the weather is not configured when the household has no location."
)


def _fmt(value, suffix: str = "") -> str:
    if value is None:
        return "?"
    if isinstance(value, float):
        value = round(value)
    return f"{value}{suffix}"


def _get_weather_handler(
    *,
    household,
    user=None,
    tool_input: dict[str, Any],
    client=None,
    context_entity: tuple[str, str] | None = None,
) -> ToolResult:
    from .alerts import evaluate_weather_alerts
    from .services import WeatherUnavailable, get_forecast

    if household is None or "weather" in (getattr(household, "disabled_modules", None) or []):
        return ToolResult(rendered="(weather module is not enabled for this household)")
    if household.latitude is None or household.longitude is None:
        return ToolResult(
            rendered="(weather is not configured: no location is set for this household — "
            "the user can set it in Settings)"
        )

    try:
        forecast = get_forecast(household.latitude, household.longitude)
    except WeatherUnavailable:
        return ToolResult(rendered="(weather is temporarily unavailable — try again later)")

    lines: list[str] = []
    label = getattr(household, "location_label", "") or "the household location"
    lines.append(f"Weather for {label} (timezone {forecast.get('timezone') or '?'}):")

    current = forecast.get("current") or {}
    lines.append(
        "Current: {temp}°C (feels like {app}°C), {cond}, wind {wind} km/h, humidity {hum}%.".format(
            temp=_fmt(current.get("temperature")),
            app=_fmt(current.get("apparent_temperature")),
            cond=current.get("condition") or "unknown",
            wind=_fmt(current.get("wind_speed")),
            hum=_fmt(current.get("humidity")),
        )
    )

    daily = forecast.get("daily") or []
    if daily:
        lines.append("7-day forecast:")
        for day in daily:
            lines.append(
                "- {date}: {tmin}–{tmax}°C, {cond}, rain {precip}%, wind gusts {gust} km/h".format(
                    date=day.get("date"),
                    tmin=_fmt(day.get("temp_min")),
                    tmax=_fmt(day.get("temp_max")),
                    cond=day.get("condition") or "unknown",
                    precip=_fmt(day.get("precipitation_probability_max")),
                    gust=_fmt(day.get("wind_gusts_max")),
                )
            )

    alerts = evaluate_weather_alerts(household)
    if alerts:
        kinds = ", ".join(sorted({a["kind"] for a in alerts}))
        lines.append(f"Active weather alerts: {kinds}.")
    else:
        lines.append("Active weather alerts: none.")

    return ToolResult(rendered="\n".join(lines))


def build_get_weather_tool() -> AgentTool:
    """Factory for the ``get_weather`` agent tool (registered from apps.py)."""
    return AgentTool(
        name=GET_WEATHER,
        description=_GET_WEATHER_DESCRIPTION,
        input_schema=_GET_WEATHER_SCHEMA,
        handler=_get_weather_handler,
    )
