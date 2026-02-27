"""
Zones URLs.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ZoneViewSet

router = DefaultRouter()
router.register(r'', ZoneViewSet, basename='zone')

urlpatterns = [
    path('', include(router.urls)),
]
