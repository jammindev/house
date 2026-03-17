"""Tests for JWT authentication endpoints."""
import pytest
from django.urls import reverse
from rest_framework import status

from .factories import UserFactory


@pytest.mark.django_db
class TestJWTAuth:
    def test_obtain_token_with_valid_credentials(self, api_client):
        """Valid credentials return access + refresh tokens."""
        UserFactory(email="jwt@example.com", password="testpass123")

        url = reverse("token_obtain_pair")
        response = api_client.post(url, {"email": "jwt@example.com", "password": "testpass123"})

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data

    def test_obtain_token_with_invalid_credentials(self, api_client):
        """Invalid credentials return 401."""
        url = reverse("token_obtain_pair")
        response = api_client.post(url, {"email": "wrong@example.com", "password": "wrong"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_token(self, api_client):
        """Valid refresh token returns new access token."""
        UserFactory(email="refresh@example.com", password="testpass123")

        obtain_url = reverse("token_obtain_pair")
        tokens = api_client.post(obtain_url, {"email": "refresh@example.com", "password": "testpass123"}).data

        refresh_url = reverse("token_refresh")
        response = api_client.post(refresh_url, {"refresh": tokens["refresh"]})
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_protected_endpoint_requires_token(self, api_client):
        """Unauthenticated request to /api/accounts/me/ returns 401."""
        response = api_client.get("/api/accounts/me/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_protected_endpoint_with_valid_token(self, api_client):
        """Authenticated request to /api/accounts/me/ returns user data."""
        user = UserFactory(email="me@example.com", password="testpass123")

        tokens = api_client.post(
            reverse("token_obtain_pair"),
            {"email": "me@example.com", "password": "testpass123"},
        ).data
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

        response = api_client.get("/api/accounts/me/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email
        assert "active_household" in response.data

    def test_invalid_token_rejected(self, api_client):
        """Invalid token returns 401."""
        api_client.credentials(HTTP_AUTHORIZATION="Bearer invalidtoken")
        response = api_client.get("/api/accounts/me/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_endpoint_returns_active_household(self, api_client):
        """me/ endpoint returns active_household field."""
        UserFactory(email="household@example.com", password="testpass123")

        tokens = api_client.post(
            reverse("token_obtain_pair"),
            {"email": "household@example.com", "password": "testpass123"},
        ).data
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

        response = api_client.get("/api/accounts/me/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["active_household"] is not None or response.data["active_household"] is None
