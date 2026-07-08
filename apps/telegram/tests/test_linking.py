"""Signed link tokens + account linking."""
from __future__ import annotations

import re

import pytest
from rest_framework import status

from accounts.tests.factories import UserFactory
from telegram.linking import consume_link_token, link_account, make_link_token
from telegram.models import TelegramAccount

pytestmark = pytest.mark.django_db


class TestLinkToken:
    def test_roundtrip(self, user):
        assert consume_link_token(make_link_token(user)) == user

    def test_token_fits_telegram_start_payload(self, user):
        token = make_link_token(user)
        assert len(token) <= 64
        assert re.fullmatch(r"[A-Za-z0-9_-]+", token)

    def test_tampered_token_is_rejected(self, user):
        token = make_link_token(user)
        other = UserFactory(email="tg-other@example.com")
        forged = f"{other.pk}{token[token.index('_'):]}"
        assert consume_link_token(forged) is None

    def test_expired_token_is_rejected(self, user, settings):
        token = make_link_token(user)
        settings.TELEGRAM_LINK_TOKEN_MAX_AGE_SECONDS = -1
        assert consume_link_token(token) is None

    def test_garbage_tokens_are_rejected(self, db):
        for bad in ("", "short", "x" * 80, None):
            assert consume_link_token(bad) is None

    def test_deleted_or_inactive_user_is_rejected(self, user):
        token = make_link_token(user)
        user.is_active = False
        user.save(update_fields=["is_active"])
        assert consume_link_token(token) is None


class TestLinkAccount:
    def test_creates_account(self, user):
        account = link_account(user, chat_id=111, username="benj")
        assert account.chat_id == 111
        assert account.username == "benj"
        assert user.telegram_account == account

    def test_relink_updates_chat_id(self, user):
        link_account(user, chat_id=111)
        account = link_account(user, chat_id=222, username="newphone")
        assert TelegramAccount.objects.filter(user=user).count() == 1
        assert account.chat_id == 222

    def test_chat_id_is_stolen_from_previous_owner(self, user):
        other = UserFactory(email="tg-prev@example.com")
        link_account(other, chat_id=333)
        link_account(user, chat_id=333)
        assert not TelegramAccount.objects.filter(user=other).exists()
        assert TelegramAccount.objects.get(chat_id=333).user == user


class TestLinkTokenEndpoint:
    URL = "/api/telegram/link-token/"

    def test_returns_deep_link(self, api_client, user):
        resp = api_client.post(self.URL)
        assert resp.status_code == status.HTTP_200_OK
        deep_link = resp.json()["deep_link"]
        assert deep_link.startswith("https://t.me/house_test_bot?start=")
        token = deep_link.split("start=")[1]
        assert consume_link_token(token) == user

    def test_anonymous_is_rejected(self):
        from rest_framework.test import APIClient

        resp = APIClient().post(self.URL)
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_disabled_channel_returns_503(self, api_client, settings):
        settings.TELEGRAM_BOT_TOKEN = ""
        assert api_client.post(self.URL).status_code == status.HTTP_503_SERVICE_UNAVAILABLE
