from django.urls import path

from .views import app_electricity_view

urlpatterns = [
    path("", app_electricity_view, name="app_electricity"),
]
