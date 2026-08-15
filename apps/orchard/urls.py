from rest_framework.routers import DefaultRouter

from .views import CareRuleViewSet, HarvestViewSet, TreeEventViewSet, TreeViewSet

router = DefaultRouter()
router.register(r'events', TreeEventViewSet, basename='orchard-event')
router.register(r'care-rules', CareRuleViewSet, basename='orchard-rule')
router.register(r'harvests', HarvestViewSet, basename='orchard-harvest')
# Registered last: its prefix is empty, so it would swallow the named routes above.
router.register(r'trees', TreeViewSet, basename='orchard-tree')

urlpatterns = [*router.urls]
