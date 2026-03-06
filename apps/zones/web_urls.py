from django.urls import path

from .views_web import AppZonesView, AppZoneDetailView

urlpatterns = [
    path("", AppZonesView.as_view(), name="app_zones"),
    path("<uuid:zone_id>/", AppZoneDetailView.as_view(), name="app_zone_detail"),
]
