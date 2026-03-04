from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import StockCategoryViewSet, StockItemViewSet

router = DefaultRouter()
router.register(r"categories", StockCategoryViewSet, basename="stock-category")
router.register(r"", StockItemViewSet, basename="stock-item")

urlpatterns = [
    path("", include(router.urls)),
]
