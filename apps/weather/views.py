"""
Weather REST API (parcours 17) — read-only.

No model, no writes: the weather module reads live forecasts from Open-Meteo
(via ``weather.services``) for the current household's stored location, and
proxies the geocoding search used by the settings UI to pick that location.
"""
import logging
from datetime import date

from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHouseholdMember

from . import services

logger = logging.getLogger(__name__)


class WeatherView(APIView):
    """Current conditions + today's hourly + 7-day forecast for the household.

    Always returns HTTP 200. ``configured=False`` when the household has no
    location yet (not an error — the UI shows a "set your location" state).
    ``error=True`` when Open-Meteo is unreachable (graceful degradation).
    """

    permission_classes = [IsHouseholdMember]

    def get(self, request):
        household = request.household
        if household is None or household.latitude is None or household.longitude is None:
            return Response({"configured": False})

        base = {
            "configured": True,
            "latitude": household.latitude,
            "longitude": household.longitude,
            "location_label": household.location_label,
        }
        try:
            forecast = services.get_forecast(household.latitude, household.longitude)
        except services.WeatherUnavailable:
            return Response({**base, "error": True})
        return Response({**base, "error": False, **forecast})


class WeatherHistoryView(APIView):
    """Daily mean temperatures over a period, to overlay on the consumption
    charts (parcours 17 Lot 6). Always HTTP 200; ``configured=False`` when the
    household has no location, ``error=True`` when the archive is unreachable.
    The frontend aggregates these daily points to its own consumption buckets.
    """

    permission_classes = [IsHouseholdMember]

    def get(self, request):
        household = request.household
        if household is None or household.latitude is None or household.longitude is None:
            return Response({"configured": False, "points": []})

        try:
            date_from = date.fromisoformat(request.query_params.get("date_from", ""))
            date_to = date.fromisoformat(request.query_params.get("date_to", ""))
        except ValueError:
            raise ValidationError({"date_from": "date_from and date_to must be ISO dates (YYYY-MM-DD)."})
        if date_to < date_from:
            raise ValidationError({"date_to": "date_to must be on or after date_from."})

        try:
            points = services.get_history(
                household.latitude, household.longitude,
                date_from.isoformat(), date_to.isoformat(),
            )
        except services.WeatherUnavailable:
            return Response({"configured": True, "error": True, "points": []})
        return Response({"configured": True, "error": False, "points": points})


class WeatherGeocodeView(APIView):
    """Proxy Open-Meteo geocoding — used by the owner to pick the household
    location from a city name. Any authenticated user may query; the resulting
    coordinates are only *persisted* through the owner-gated household update.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "")
        language = (getattr(request, "LANGUAGE_CODE", "") or "en")[:2]
        try:
            results = services.geocode(query, language=language)
        except services.WeatherUnavailable:
            return Response({"results": [], "error": True})
        return Response({"results": results, "error": False})
