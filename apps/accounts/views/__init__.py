"""Views package for accounts app."""
from .api import AuthViewSet, UserViewSet
from .template_views import (
    HomeView,
    LoginView,
    DashboardView,
    LogoutView,
    AppDashboardView,
)

__all__ = [
    'AuthViewSet',
    'UserViewSet',
    'HomeView',
    'LoginView',
    'DashboardView',
    'LogoutView',
    'AppDashboardView',
]
