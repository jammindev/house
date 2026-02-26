"""Views package for accounts app."""
from .api import AuthViewSet, UserViewSet
from .template_views import (
    home_view,
    login_view,
    dashboard_view,
    logout_view,
    app_dashboard_view,
    app_placeholder_view,
    app_zones_view,
    app_components_view,
    app_interactions_view,
    app_interaction_new_view,
)

__all__ = [
    'AuthViewSet',
    'UserViewSet',
    'home_view',
    'login_view',
    'dashboard_view',
    'logout_view',
    'app_dashboard_view',
    'app_placeholder_view',
    'app_zones_view',
    'app_components_view',
    'app_interactions_view',
    'app_interaction_new_view',
]
