"""
Households URLs.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HouseholdViewSet

router = DefaultRouter()
router.register(r'', HouseholdViewSet, basename='household')

urlpatterns = [
    path('', include(router.urls)),
]
