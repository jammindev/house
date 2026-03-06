from django.urls import path

from .views import AppElectricityView

urlpatterns = [
    path("", AppElectricityView.as_view(), name="app_electricity"),
]
