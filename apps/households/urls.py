"""
Households URLs.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter, SimpleRouter
from .views import HouseholdViewSet, HouseholdInvitationViewSet

# SimpleRouter (no API root) so /invitations/ prefix doesn't shadow the main household list
invitation_router = SimpleRouter()
invitation_router.register(r'invitations', HouseholdInvitationViewSet, basename='household-invitation')

router = DefaultRouter()
router.register(r'', HouseholdViewSet, basename='household')

urlpatterns = [
    # Invitations first so /invitations/ doesn't match household detail <pk>
    path('', include(invitation_router.urls)),
    path('', include(router.urls)),
]
