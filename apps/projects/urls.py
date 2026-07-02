from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProjectViewSet,
    ProjectGroupViewSet,
    ProjectZoneViewSet,
)

router = DefaultRouter()
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"project-groups", ProjectGroupViewSet, basename="project-group")
router.register(r"project-zones", ProjectZoneViewSet, basename="project-zone")

urlpatterns = [
    path("", include(router.urls)),
]
