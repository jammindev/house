# electricity/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BreakerViewSet,
    CircuitUsagePointLinkViewSet,
    ElectricCircuitViewSet,
    ElectricityBoardViewSet,
    ElectricityHealthView,
    MappingLookupView,
    PlanChangeLogViewSet,
    ResidualCurrentDeviceViewSet,
    UsagePointViewSet,
)

router = DefaultRouter()
router.register(r"boards", ElectricityBoardViewSet, basename="electricity-board")
router.register(r"rcds", ResidualCurrentDeviceViewSet, basename="electricity-rcd")
router.register(r"breakers", BreakerViewSet, basename="electricity-breaker")
router.register(r"circuits", ElectricCircuitViewSet, basename="electricity-circuit")
router.register(r"usage-points", UsagePointViewSet, basename="electricity-usage-point")
router.register(r"links", CircuitUsagePointLinkViewSet, basename="electricity-link")
router.register(r"change-logs", PlanChangeLogViewSet, basename="electricity-change-log")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", ElectricityHealthView.as_view(), name="electricity-health"),
    path("mapping/lookup/", MappingLookupView.as_view(), name="electricity-mapping-lookup"),
]
