"""Compatibility module re-exporting views from accounts.views package."""

from .views import AuthViewSet, UserViewSet, login_view, dashboard_view, logout_view

__all__ = [
    "AuthViewSet",
    "UserViewSet",
    "login_view",
    "dashboard_view",
    "logout_view",
]
