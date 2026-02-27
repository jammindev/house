from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import StructureViewSet

router = DefaultRouter()
router.register(r"", StructureViewSet, basename="structure")

urlpatterns = [
    path("", include(router.urls)),
]
