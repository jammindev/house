from django.urls import path

from .views_web import app_zones_view

urlpatterns = [
    path("", app_zones_view, name="app_zones"),
]
