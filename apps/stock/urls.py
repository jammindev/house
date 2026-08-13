from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import StockCategoryViewSet, StockItemViewSet, StockLevelReadingViewSet

router = DefaultRouter()
# L'article est enregistré sur la racine (`/stock/<id>/`) : tout préfixe littéral
# doit passer AVANT lui, sinon il est avalé comme un identifiant d'article.
router.register(r"categories", StockCategoryViewSet, basename="stock-category")
router.register(r"readings", StockLevelReadingViewSet, basename="stock-reading")
router.register(r"", StockItemViewSet, basename="stock-item")

urlpatterns = [
    path("", include(router.urls)),
]
