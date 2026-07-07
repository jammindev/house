"""Shared fixtures for the Telegram channel tests.

The Telegram HTTP client is always mocked (`bot` fixture) — no test ever
performs a network call. The locmem cache is cleared around each test because
the dedup/cooldown keys would otherwise leak between tests.
"""
from __future__ import annotations

from unittest import mock

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember

WEBHOOK_SECRET = "test-webhook-secret"


@pytest.fixture(autouse=True)
def _telegram_settings(settings):
    settings.TELEGRAM_BOT_TOKEN = "123456:test-token"
    settings.TELEGRAM_BOT_USERNAME = "house_test_bot"
    settings.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET
    return settings


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def bot(monkeypatch):
    """Mock TelegramClient handed out by every get_client() call."""
    client = mock.Mock()
    client.enabled = True
    for module in ("telegram.service", "telegram.views"):
        monkeypatch.setattr(f"{module}.get_client", lambda c=client: c, raising=False)
    monkeypatch.setattr("telegram.client.get_client", lambda c=client: c)
    return client


@pytest.fixture
def user(db):
    return UserFactory(email="tg-user@example.com")


@pytest.fixture
def household(db, user):
    h = Household.objects.create(name="Telegram House")
    HouseholdMember.objects.create(user=user, household=h, role=HouseholdMember.Role.OWNER)
    user.active_household = h
    user.save(update_fields=["active_household"])
    return h


@pytest.fixture
def linked_account(db, user, household):
    from telegram.linking import link_account

    return link_account(user, chat_id=987654321, username="benj")


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def webhook_post(payload: dict, secret: str | None = WEBHOOK_SECRET):
    client = APIClient()
    headers = {}
    if secret is not None:
        headers["HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN"] = secret
    return client.post("/api/telegram/webhook/", payload, format="json", **headers)


def text_update(chat_id: int, text: str, *, update_id: int = 1, sender: dict | None = None) -> dict:
    return {
        "update_id": update_id,
        "message": {
            "message_id": 10,
            "chat": {"id": chat_id, "type": "private"},
            "from": sender or {"id": chat_id, "username": "benj", "language_code": "fr"},
            "text": text,
        },
    }
