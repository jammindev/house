from django.urls import path

from .views import CapabilitiesView

urlpatterns = [
    path("", CapabilitiesView.as_view(), name="capabilities"),
]
