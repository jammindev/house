"""The conversational "stop": one word disables every proactive ping."""
from __future__ import annotations

from datetime import time
from unittest import mock

import pytest

from pings.models import PingPreference
from telegram import service

from .conftest import text_update

pytestmark = pytest.mark.django_db


def _pref(household, user, ping_type="egg_log", enabled=True):
    return PingPreference.objects.create(
        household=household,
        user=user,
        ping_type=ping_type,
        enabled=enabled,
        send_at=time(19, 0),
        created_by=user,
    )


class TestConversationalStop:
    def test_stop_disables_every_enabled_ping(self, bot, linked_account, household, user):
        _pref(household, user, "egg_log")
        _pref(household, user, "water_reading")
        service.handle_update(text_update(linked_account.chat_id, "stop"))
        assert not PingPreference.objects.filter(user=user, enabled=True).exists()
        assert bot.send_message.called

    @pytest.mark.parametrize("text", ["STOP", "Stop", "/stop"])
    def test_stop_is_case_insensitive_and_accepts_the_command_form(
        self, bot, linked_account, household, user, text
    ):
        _pref(household, user)
        service.handle_update(text_update(linked_account.chat_id, text))
        assert not PingPreference.objects.filter(user=user, enabled=True).exists()

    def test_stop_never_reaches_the_agent(self, bot, linked_account, household, user):
        _pref(household, user)
        with mock.patch.object(service, "_handle_question") as ask:
            service.handle_update(text_update(linked_account.chat_id, "stop"))
        ask.assert_not_called()

    def test_stop_inside_a_sentence_is_a_normal_question(
        self, bot, linked_account, household, user
    ):
        _pref(household, user)
        with mock.patch.object(service, "_handle_question") as ask:
            service.handle_update(
                text_update(linked_account.chat_id, "stop la lumière du garage")
            )
        ask.assert_called_once()
        assert PingPreference.objects.filter(user=user, enabled=True).exists()

    def test_stop_with_nothing_enabled_still_confirms(
        self, bot, linked_account, household, user
    ):
        _pref(household, user, enabled=False)
        service.handle_update(text_update(linked_account.chat_id, "stop"))
        assert bot.send_message.called
        pref = PingPreference.objects.get(user=user)
        assert pref.enabled is False

    def test_stop_from_unlinked_chat_gets_the_fixed_not_linked_reply(self, bot, db):
        service.handle_update(text_update(31337, "stop"))
        assert bot.send_message.called

    def test_disabled_prefs_of_other_users_are_untouched(
        self, bot, linked_account, household, user
    ):
        from accounts.tests.factories import UserFactory

        other = UserFactory(email="other@example.com")
        _pref(household, user)
        other_pref = _pref(household, other)
        service.handle_update(text_update(linked_account.chat_id, "stop"))
        other_pref.refresh_from_db()
        assert other_pref.enabled is True
