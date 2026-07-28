"""Household recap API routes."""
from rest_framework.routers import DefaultRouter

from .views import HouseholdRecapViewSet

router = DefaultRouter()
router.register(r"", HouseholdRecapViewSet, basename="recap")

urlpatterns = router.urls
