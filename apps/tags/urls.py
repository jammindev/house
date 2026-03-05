from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import TagViewSet, TagLinkViewSet

router = DefaultRouter()
router.register(r"tags", TagViewSet, basename="tag")
router.register(r"tag-links", TagLinkViewSet, basename="tag-link")

urlpatterns = [
    path("", include(router.urls)),
]
