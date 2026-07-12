from django.urls import path

from .views import PingListView, PingPreferenceView

urlpatterns = [
    path("", PingListView.as_view(), name="pings-list"),
    path("<str:ping_type>/", PingPreferenceView.as_view(), name="pings-preference"),
]
