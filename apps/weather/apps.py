# weather/apps.py
from django.apps import AppConfig


class WeatherConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "weather"

    def ready(self):
        # Parcours 17 Lot 4 — proactive weather-alert ping (frost/heatwave/wind/
        # storm). Reuses the existing ping scheduler; gated by the weather module.
        from datetime import time as dt_time

        from pings.registry import PingSpec, register as register_ping

        from .pings import build_weather_alert_ping

        register_ping(PingSpec(
            ping_type="weather_alert",
            module="weather",
            build_message=build_weather_alert_ping,
            default_send_at=dt_time(8, 0),  # morning heads-up, household-local
        ))

        # Parcours 17 Lot 5 — read-only agent tool. No household-scoped model, so
        # a dedicated tool rather than a SearchableSpec. Declared here, never
        # touching apps/agent/ (same pattern as writables/listables).
        from agent.tools import register as register_tool

        from .agent import build_get_weather_tool

        register_tool(build_get_weather_tool())
