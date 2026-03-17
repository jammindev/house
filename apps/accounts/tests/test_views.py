"""
Tests for Django views in the SPA architecture.

The login/dashboard/logout template views have been removed.
Authentication is now handled by the React SPA via JWT.
The Django backend only serves:
  - /admin/  → Django admin (SessionAuthentication)
  - /api/**  → REST API (JWT)
  - /**      → index.html (SPA catchall)
"""
import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestSPACatchall:
    """The SPA catchall serves index.html for any non-API, non-admin path."""

    def test_root_serves_spa(self, client):
        response = client.get("/")
        assert response.status_code == 200

    def test_app_route_serves_spa(self, client):
        response = client.get("/app/dashboard")
        assert response.status_code == 200

    def test_login_route_serves_spa(self, client):
        """React login page is served by the SPA catchall."""
        response = client.get("/login")
        assert response.status_code == 200

    def test_unknown_route_serves_spa(self, client):
        response = client.get("/some/unknown/path")
        assert response.status_code == 200


@pytest.mark.django_db
class TestAdminAccess:
    """Django admin must remain accessible via SessionAuthentication."""

    def test_admin_redirects_to_login_when_unauthenticated(self, client):
        response = client.get("/admin/")
        assert response.status_code == 302
        assert "/admin/login/" in response.url

    def test_admin_login_page_renders(self, client):
        response = client.get("/admin/login/")
        assert response.status_code == 200
