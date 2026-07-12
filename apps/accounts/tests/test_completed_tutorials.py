"""PATCH /api/accounts/users/me/ completed_tutorials — page tutoriel."""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .factories import UserFactory


@pytest.fixture
def user(db):
    return UserFactory(email="tutorials@example.com")


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestCompletedTutorials:
    def _url(self):
        return reverse("user-me")

    def test_empty_by_default(self, auth_client):
        response = auth_client.get(self._url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["completed_tutorials"] == []

    def test_patch_valid_list_persists(self, auth_client, user):
        keys = ["guide.tasks", "start.create-zone"]
        response = auth_client.patch(
            self._url(), {"completed_tutorials": keys}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.completed_tutorials == keys
        assert auth_client.get(self._url()).data["completed_tutorials"] == keys

    def test_unknown_keys_accepted(self, auth_client):
        # Keys live in the frontend registry — the backend only checks shape,
        # so a newly shipped guide never requires a backend change.
        response = auth_client.patch(
            self._url(), {"completed_tutorials": ["guide.future-module"]}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK

    def test_duplicates_are_removed_preserving_order(self, auth_client):
        response = auth_client.patch(
            self._url(),
            {"completed_tutorials": ["guide.tasks", "guide.tasks", "guide.zones"]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["completed_tutorials"] == ["guide.tasks", "guide.zones"]

    def test_non_list_payload_rejected(self, auth_client, user):
        response = auth_client.patch(
            self._url(), {"completed_tutorials": "guide.tasks"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        user.refresh_from_db()
        assert user.completed_tutorials == []

    def test_non_string_items_rejected(self, auth_client):
        response = auth_client.patch(
            self._url(), {"completed_tutorials": [42]}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_oversized_key_rejected(self, auth_client):
        response = auth_client.patch(
            self._url(), {"completed_tutorials": ["x" * 101]}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_oversized_list_rejected(self, auth_client):
        keys = [f"guide.k{i}" for i in range(501)]
        response = auth_client.patch(
            self._url(), {"completed_tutorials": keys}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
