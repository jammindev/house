# electricity/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CircuitUsagePointLinkViewSet,
    ElectricCircuitViewSet,
    ElectricityBoardViewSet,
    MaintenanceEventViewSet,
    PlanChangeLogViewSet,
    ProtectiveDeviceViewSet,
    UsagePointViewSet,
)

router = DefaultRouter()
router.register(r"boards", ElectricityBoardViewSet, basename="electricity-board")
router.register(r"protective-devices", ProtectiveDeviceViewSet, basename="electricity-protective-device")
router.register(r"circuits", ElectricCircuitViewSet, basename="electricity-circuit")
router.register(r"usage-points", UsagePointViewSet, basename="electricity-usage-point")
router.register(r"links", CircuitUsagePointLinkViewSet, basename="electricity-link")
router.register(r"maintenance-events", MaintenanceEventViewSet, basename="electricity-maintenance-event")
router.register(r"change-logs", PlanChangeLogViewSet, basename="electricity-change-log")

urlpatterns = [
    path("", include(router.urls)),
]
