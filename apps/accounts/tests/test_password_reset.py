"""Tests for the password reset flow (request + confirm)."""
import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status

from .factories import UserFactory


@pytest.fixture(autouse=True)
def _clear_cache_and_outbox():
    """Reset throttle cache + email outbox between tests."""
    from django.core.cache import cache
    cache.clear()
    mail.outbox = []
    yield
    cache.clear()


@pytest.mark.django_db
class TestPasswordResetRequest:
    """POST /api/accounts/auth/password-reset/"""

    url_name = "auth-password-reset"

    def test_returns_200_for_known_email_and_sends_email(self, api_client):
        UserFactory(email="ben@example.com", password="oldpass123")

        response = api_client.post(reverse(self.url_name), {"email": "ben@example.com"})

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.to == ["ben@example.com"]
        assert "reset-password?uid=" in message.body
        assert "&token=" in message.body
        # HTML alternative attached
        assert any("text/html" in alt[1] for alt in message.alternatives)

    def test_returns_200_for_unknown_email_and_sends_no_email(self, api_client):
        """Should NOT reveal whether the email exists in the database."""
        response = api_client.post(reverse(self.url_name), {"email": "unknown@example.com"})

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 0

    def test_returns_200_for_inactive_user_and_sends_no_email(self, api_client):
        UserFactory(email="inactive@example.com", is_active=False)

        response = api_client.post(reverse(self.url_name), {"email": "inactive@example.com"})

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 0

    def test_email_lookup_is_case_insensitive(self, api_client):
        UserFactory(email="ben@example.com")

        response = api_client.post(reverse(self.url_name), {"email": "BEN@example.com"})

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1

    def test_missing_email_returns_400(self, api_client):
        response = api_client.post(reverse(self.url_name), {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert len(mail.outbox) == 0

    def test_throttled_after_3_requests_per_email(self, api_client):
        """4th request for the same email within an hour returns 429."""
        UserFactory(email="ben@example.com")

        for _ in range(3):
            response = api_client.post(reverse(self.url_name), {"email": "ben@example.com"})
            assert response.status_code == status.HTTP_200_OK

        response = api_client.post(reverse(self.url_name), {"email": "ben@example.com"})
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


@pytest.mark.django_db
class TestPasswordResetConfirm:
    """POST /api/accounts/auth/password-reset/confirm/"""

    url_name = "auth-password-reset-confirm"

    def _make_token(self, user):
        return (
            urlsafe_base64_encode(force_bytes(user.pk)),
            default_token_generator.make_token(user),
        )

    def test_valid_token_sets_new_password(self, api_client):
        user = UserFactory(email="ben@example.com", password="oldpass123")
        uid, token = self._make_token(user)

        response = api_client.post(
            reverse(self.url_name),
            {"uid": uid, "token": token, "new_password": "BrandNewPass!2026"},
        )

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password("BrandNewPass!2026")
        assert not user.check_password("oldpass123")

    def test_token_cannot_be_reused_after_password_change(self, api_client):
        user = UserFactory(email="ben@example.com", password="oldpass123")
        uid, token = self._make_token(user)

        first = api_client.post(
            reverse(self.url_name),
            {"uid": uid, "token": token, "new_password": "BrandNewPass!2026"},
        )
        assert first.status_code == status.HTTP_200_OK

        second = api_client.post(
            reverse(self.url_name),
            {"uid": uid, "token": token, "new_password": "AnotherPass!2026"},
        )
        assert second.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_token_returns_400(self, api_client):
        user = UserFactory(email="ben@example.com")
        uid, _real = self._make_token(user)

        response = api_client.post(
            reverse(self.url_name),
            {"uid": uid, "token": "not-a-real-token", "new_password": "BrandNewPass!2026"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_uid_returns_400(self, api_client):
        user = UserFactory(email="ben@example.com")
        _uid, token = self._make_token(user)

        response = api_client.post(
            reverse(self.url_name),
            {"uid": "garbage", "token": token, "new_password": "BrandNewPass!2026"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_inactive_user_uid_returns_400(self, api_client):
        user = UserFactory(email="ben@example.com", is_active=False)
        uid, token = self._make_token(user)

        response = api_client.post(
            reverse(self.url_name),
            {"uid": uid, "token": token, "new_password": "BrandNewPass!2026"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_password_validation_enforced(self, api_client):
        """Django password validators (length, common, numeric) must apply."""
        user = UserFactory(email="ben@example.com", password="oldpass123")
        uid, token = self._make_token(user)

        response = api_client.post(
            reverse(self.url_name),
            {"uid": uid, "token": token, "new_password": "short"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        user.refresh_from_db()
        assert user.check_password("oldpass123")

    def test_missing_fields_returns_400(self, api_client):
        response = api_client.post(reverse(self.url_name), {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
