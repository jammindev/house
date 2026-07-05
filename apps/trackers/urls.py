from rest_framework.routers import DefaultRouter

from .views import TrackerEntryViewSet, TrackerViewSet

router = DefaultRouter()
router.register(r'trackers', TrackerViewSet, basename='tracker')
router.register(r'entries', TrackerEntryViewSet, basename='tracker-entry')

urlpatterns = router.urls
