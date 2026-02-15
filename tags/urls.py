from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import TagViewSet, InteractionTagViewSet

router = DefaultRouter()
router.register(r"tags", TagViewSet, basename="tag")
router.register(r"interaction-tags", InteractionTagViewSet, basename="interaction-tag")

urlpatterns = [
    path("", include(router.urls)),
]
