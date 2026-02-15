from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import SystemAdminViewSet

router = DefaultRouter()
router.register(r"system-admins", SystemAdminViewSet, basename="system-admin")

urlpatterns = [
    path("", include(router.urls)),
]
