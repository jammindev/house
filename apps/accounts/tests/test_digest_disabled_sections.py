"""
Tests for validate_digest_disabled_sections + PATCH /api/accounts/users/me/
digest_disabled_sections.

Covers: serializer validation (rejects non-list, rejects unknown keys, deduplicates
valid keys); PATCH /me persists valid values; API correctly rejects invalid payloads.
"""
from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .factories import UserFactory


@pytest.fixture
def user(db):
    return UserFactory(email="digest-sections@example.com")


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _url():
    return reverse("user-me")


# ---------------------------------------------------------------------------
# validate_digest_disabled_sections — serializer-level
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestValidateDigestDisabledSections:
    """validate_digest_disabled_sections: shape and content checks."""

    def test_empty_list_is_valid(self, auth_client, user):
        response = auth_client.patch(
            _url(), {"digest_disabled_sections": []}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.digest_disabled_sections == []

    def test_valid_keys_accepted(self, auth_client, user):
        response = auth_client.patch(
            _url(),
            {"digest_disabled_sections": ["tasks", "weather"]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert "tasks" in user.digest_disabled_sections
        assert "weather" in user.digest_disabled_sections

    def test_all_known_keys_accepted(self, auth_client, user):
        from agent.digest.collectors import SECTION_KEYS
        response = auth_client.patch(
            _url(),
            {"digest_disabled_sections": list(SECTION_KEYS)},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert set(user.digest_disabled_sections) == set(SECTION_KEYS)

    def test_unknown_key_rejected(self, auth_client, user):
        response = auth_client.patch(
            _url(),
            {"digest_disabled_sections": ["tasks", "totally_unknown_section"]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "digest_disabled_sections" in response.data

    def test_non_list_rejected_string(self, auth_client, user):
        response = auth_client.patch(
            _url(),
            {"digest_disabled_sections": "tasks"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "digest_disabled_sections" in response.data

    def test_non_list_rejected_dict(self, auth_client, user):
        response = auth_client.patch(
            _url(),
            {"digest_disabled_sections": {"key": "tasks"}},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "digest_disabled_sections" in response.data

    def test_duplicates_are_deduped(self, auth_client, user):
        response = auth_client.patch(
            _url(),
            {"digest_disabled_sections": ["tasks", "tasks", "weather"]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.digest_disabled_sections.count("tasks") == 1

    def test_db_state_persists_after_patch(self, auth_client, user):
        auth_client.patch(
            _url(),
            {"digest_disabled_sections": ["chickens", "stock"]},
            format="json",
        )
        user.refresh_from_db()
        assert "chickens" in user.digest_disabled_sections
        assert "stock" in user.digest_disabled_sections

    def test_me_endpoint_exposes_field(self, auth_client, user):
        response = auth_client.get(_url())
        assert response.status_code == status.HTTP_200_OK
        assert "digest_disabled_sections" in response.data

    def test_default_value_is_empty_list(self, auth_client, user):
        response = auth_client.get(_url())
        assert response.data["digest_disabled_sections"] == []

    def test_patch_replaces_existing_value(self, auth_client, user):
        # First patch: set some sections
        auth_client.patch(
            _url(),
            {"digest_disabled_sections": ["tasks"]},
            format="json",
        )
        # Second patch: replace entirely
        auth_client.patch(
            _url(),
            {"digest_disabled_sections": ["stock"]},
            format="json",
        )
        user.refresh_from_db()
        assert user.digest_disabled_sections == ["stock"]
