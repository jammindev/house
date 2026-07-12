"""Shared fixtures for the pings app tests.

A synthetic ``PingSpec`` is registered around each test that needs one, so the
scheduler core is tested independently of the real specs (chickens…). The
Telegram outbound path is mocked at the client boundary — no network call.
"""
from __future__ import annotations

from datetime import time
from unittest import mock

import pytest

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from pings import registry
from pings.registry import PingSpec

PING_TYPE = "test_ping"


@pytest.fixture
def household(db):
    return Household.objects.create(name="Ping House", timezone="Europe/Paris")


@pytest.fixture
def user(db, household):
    user = UserFactory(email="ping-user@example.com")
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )
    user.active_household = household
    user.locale = "fr"
    user.save(update_fields=["active_household", "locale"])
    return user


@pytest.fixture
def linked_account(db, user):
    from telegram.models import TelegramAccount

    return TelegramAccount.objects.create(user=user, chat_id=111222333)


@pytest.fixture
def spec_message():
    """Mutable holder so a test can change what the spec answers."""
    return {"text": "Test question?"}


@pytest.fixture
def ping_spec(spec_message):
    """Register a synthetic spec for the duration of the test."""

    def build_message(household, user, *, today):
        return spec_message["text"]

    spec = PingSpec(
        ping_type=PING_TYPE,
        build_message=build_message,
        default_send_at=time(19, 0),
    )
    registry.register(spec)
    yield spec
    registry.REGISTRY.pop(PING_TYPE, None)


@pytest.fixture
def outbound_client(monkeypatch):
    """Mock the Telegram client used by telegram.outbound (delivery succeeds)."""
    client = mock.Mock()
    client.enabled = True
    client.send_message.return_value = {"message_id": 1}
    monkeypatch.setattr("telegram.outbound.get_client", lambda: client)
    return client


@pytest.fixture
def preference(db, household, user, ping_spec):
    from pings.services import upsert_preference

    return upsert_preference(
        household, user, ping_type=PING_TYPE, enabled=True, send_at=time(19, 0)
    )
