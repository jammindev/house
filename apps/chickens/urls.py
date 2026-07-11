from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ChickenEventViewSet,
    ChickenSettingsView,
    ChickenSummaryView,
    ChickenViewSet,
    EggLogViewSet,
)

router = DefaultRouter()
router.register(r'egg-logs', EggLogViewSet, basename='chicken-egg-log')
router.register(r'events', ChickenEventViewSet, basename='chicken-event')
router.register(r'', ChickenViewSet, basename='chicken')

urlpatterns = [
    path('settings/', ChickenSettingsView.as_view(), name='chicken-settings'),
    path('summary/', ChickenSummaryView.as_view(), name='chicken-summary'),
    *router.urls,
]
