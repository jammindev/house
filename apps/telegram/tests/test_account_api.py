"""GET/DELETE /api/telegram/account/ — status + unlink."""
from __future__ import annotations

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from telegram.models import TelegramAccount

pytestmark = pytest.mark.django_db

URL = "/api/telegram/account/"


class TestStatus:
    def test_unlinked_status(self, api_client):
        body = api_client.get(URL).json()
        assert body == {"enabled": True, "linked": False, "username": "", "linked_at": None}

    def test_linked_status(self, api_client, linked_account):
        body = api_client.get(URL).json()
        assert body["linked"] is True
        assert body["username"] == "benj"
        assert body["linked_at"] is not None

    def test_disabled_channel_flag(self, api_client, settings):
        settings.TELEGRAM_BOT_USERNAME = ""
        assert api_client.get(URL).json()["enabled"] is False

    def test_anonymous_is_rejected(self):
        assert APIClient().get(URL).status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


class TestUnlink:
    def test_delete_unlinks(self, api_client, linked_account, user):
        resp = api_client.delete(URL)
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not TelegramAccount.objects.filter(user=user).exists()

    def test_delete_without_account_is_idempotent(self, api_client):
        assert api_client.delete(URL).status_code == status.HTTP_204_NO_CONTENT

    def test_delete_only_touches_own_account(self, api_client, linked_account):
        from accounts.tests.factories import UserFactory
        from telegram.linking import link_account

        other = UserFactory(email="tg-keep@example.com")
        link_account(other, chat_id=111111)
        api_client.delete(URL)
        assert TelegramAccount.objects.filter(user=other).exists()
