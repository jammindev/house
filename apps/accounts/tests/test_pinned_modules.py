"""PATCH /api/accounts/users/me/ pinned_modules — parcours 15."""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .factories import UserFactory


@pytest.fixture
def user(db):
    return UserFactory(email="pins@example.com")


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestPinnedModules:
    def _url(self):
        return reverse("user-me")

    def test_empty_by_default(self, auth_client):
        response = auth_client.get(self._url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["pinned_modules"] == []

    def test_patch_valid_list_persists_in_order(self, auth_client, user):
        response = auth_client.patch(
            self._url(), {"pinned_modules": ["tasks", "chickens", "stock"]}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.pinned_modules == ["tasks", "chickens", "stock"]
        # order is meaningful (display order) — round-trips as sent
        assert auth_client.get(self._url()).data["pinned_modules"] == [
            "tasks", "chickens", "stock",
        ]

    def test_duplicates_are_removed_preserving_order(self, auth_client):
        response = auth_client.patch(
            self._url(), {"pinned_modules": ["tasks", "tasks", "zones"]}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["pinned_modules"] == ["tasks", "zones"]

    def test_non_pinnable_key_rejected(self, auth_client):
        # dashboard is fixed-position, never pinnable
        response = auth_client.patch(
            self._url(), {"pinned_modules": ["dashboard"]}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unknown_key_rejected(self, auth_client):
        response = auth_client.patch(
            self._url(), {"pinned_modules": ["foobar"]}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_list_payload_rejected(self, auth_client, user):
        response = auth_client.patch(
            self._url(), {"pinned_modules": "tasks"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        user.refresh_from_db()
        assert user.pinned_modules == []
