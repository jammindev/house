from django.urls import path

from .views_web import app_zones_view, app_zone_detail_view

urlpatterns = [
    path("", app_zones_view, name="app_zones"),
    path("<uuid:zone_id>/", app_zone_detail_view, name="app_zone_detail"),
]
