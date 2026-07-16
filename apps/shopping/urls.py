from rest_framework.routers import DefaultRouter

from .views import ShoppingListItemViewSet

router = DefaultRouter()
router.register(r"items", ShoppingListItemViewSet, basename="shopping-item")

urlpatterns = router.urls
