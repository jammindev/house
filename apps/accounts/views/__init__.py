"""Views package for accounts app."""
from .api import AuthViewSet, UserViewSet
from .template_views import (
    home_view,
    login_view,
    dashboard_view,
    logout_view,
    app_dashboard_view,
)

__all__ = [
    'AuthViewSet',
    'UserViewSet',
    'home_view',
    'login_view',
    'dashboard_view',
    'logout_view',
    'app_dashboard_view',
]
