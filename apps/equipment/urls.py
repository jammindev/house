from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import EquipmentViewSet, EquipmentInteractionViewSet

router = DefaultRouter()
router.register(r"equipment-interactions", EquipmentInteractionViewSet, basename="equipment-interaction")
router.register(r"", EquipmentViewSet, basename="equipment")

urlpatterns = [
    path("", include(router.urls)),
]
