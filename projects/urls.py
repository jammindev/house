from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProjectViewSet,
    ProjectGroupViewSet,
    ProjectZoneViewSet,
    ProjectAIThreadViewSet,
    ProjectAIMessageViewSet,
)

router = DefaultRouter()
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"project-groups", ProjectGroupViewSet, basename="project-group")
router.register(r"project-zones", ProjectZoneViewSet, basename="project-zone")
router.register(r"project-ai-threads", ProjectAIThreadViewSet, basename="project-ai-thread")
router.register(r"project-ai-messages", ProjectAIMessageViewSet, basename="project-ai-message")

urlpatterns = [
    path("", include(router.urls)),
]
