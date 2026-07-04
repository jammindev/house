from rest_framework.routers import DefaultRouter

from .views import AIUsageViewSet

router = DefaultRouter()
router.register(r"", AIUsageViewSet, basename="ai-usage")

urlpatterns = router.urls
