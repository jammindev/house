"""
Households URLs.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter, SimpleRouter
from .views import HouseholdViewSet, HouseholdInvitationViewSet, JoinHouseholdView

# SimpleRouter (no API root) so /invitations/ prefix doesn't shadow the main household list
invitation_router = SimpleRouter()
invitation_router.register(r'invitations', HouseholdInvitationViewSet, basename='household-invitation')

router = DefaultRouter()
router.register(r'', HouseholdViewSet, basename='household')

urlpatterns = [
    # `join/<token>/` and `invitations/` first: the household detail route is
    # `<pk>/`, whose regex would happily swallow either as an id.
    path('join/<str:token>/', JoinHouseholdView.as_view(), name='household-join'),
    path('', include(invitation_router.urls)),
    path('', include(router.urls)),
]
