"""Weather module URLs (parcours 17)."""
from django.urls import path

from .views import WeatherGeocodeView, WeatherView

urlpatterns = [
    path("", WeatherView.as_view(), name="weather"),
    path("geocode/", WeatherGeocodeView.as_view(), name="weather-geocode"),
]
