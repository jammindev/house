from rest_framework.routers import DefaultRouter

from .views import BriefingViewSet

router = DefaultRouter()
router.register(r"briefings", BriefingViewSet, basename="briefing")

urlpatterns = router.urls
