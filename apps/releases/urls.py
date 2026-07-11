from rest_framework.routers import DefaultRouter

from .views import ChangelogViewSet

router = DefaultRouter()
router.register(r"changelog", ChangelogViewSet, basename="changelog")

urlpatterns = router.urls
