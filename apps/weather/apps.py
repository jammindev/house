# weather/apps.py
from django.apps import AppConfig


class WeatherConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "weather"
    # No household-scoped model in V1 (read-only integration): no searchables /
    # writables / listables to register. The agent context is parcours 17 Lot 5.
