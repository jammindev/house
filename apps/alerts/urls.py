from django.urls import path

from .views import AlertsSummaryView


urlpatterns = [
    path("summary/", AlertsSummaryView.as_view(), name="alerts-summary"),
]
