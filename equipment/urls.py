from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import EquipmentViewSet, EquipmentInteractionViewSet

router = DefaultRouter()
router.register(r"", EquipmentViewSet, basename="equipment")
router.register(r"equipment-interactions", EquipmentInteractionViewSet, basename="equipment-interaction")

urlpatterns = [
    path("", include(router.urls)),
]
