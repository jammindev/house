from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import WaterConsumptionSummaryView, WaterReadingViewSet

router = DefaultRouter()
router.register(r"readings", WaterReadingViewSet, basename="water-reading")

urlpatterns = [
    path("consumption/summary/", WaterConsumptionSummaryView.as_view(), name="water-consumption-summary"),
    path("", include(router.urls)),
]
