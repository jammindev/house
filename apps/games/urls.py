"""Jeux du foyer — routes."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import HuntViewSet

router = DefaultRouter()
router.register(r'hunts', HuntViewSet, basename='hunt')

urlpatterns = [
    path('', include(router.urls)),
]
