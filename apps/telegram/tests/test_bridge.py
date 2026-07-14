"""The agent bridge: linked question -> service.ask -> persisted turns -> reply."""
from __future__ import annotations

from datetime import timedelta
from unittest import mock

import pytest

from django.utils import timezone

from agent.llm import LLMTimeoutError
from agent.models import AgentConversation, AgentMessage
from agent.service import AnswerResult, Citation

from telegram import service

from .conftest import text_update

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def inline_threads(monkeypatch):
    monkeypatch.setattr(service, "_spawn", lambda target, *args: target(*args))


def _patch_ask(monkeypatch, return_value=None, side_effect=None):
    fake = mock.Mock(return_value=return_value, side_effect=side_effect)
    monkeypatch.setattr("agent.service.ask", fake)
    return fake


def _answer(text="Réponse.", citations=None):
    return AnswerResult(answer=text, citations=citations or [], metadata={"model": "m"})


def _channel_conversation(household, user):
    return AgentConversation.objects.filter(
        household=household,
        created_by=user,
        context_entity_type=service.CHANNEL_ENTITY_TYPE,
        context_object_id=service.CHANNEL_OBJECT_ID,
    )


class TestQuestionBridge:
    def test_question_asks_persists_and_replies(self, bot, monkeypatch, linked_account, household, user):
        ask = _patch_ask(monkeypatch, return_value=_answer("42 €."))
        service.handle_update(text_update(linked_account.chat_id, "combien la VMC ?"))

        ask.assert_called_once()
        args, kwargs = ask.call_args
        assert args == ("combien la VMC ?", household)
        assert kwargs["user"] == user
        assert kwargs["history"] == []
        assert "context_entity" not in kwargs

        conversation = _channel_conversation(household, user).get()
        roles = [m.role for m in conversation.messages.all()]
        assert roles == [AgentMessage.Role.USER, AgentMessage.Role.AGENT]
        bot.send_chat_action.assert_called_once_with(linked_account.chat_id, "typing")
        assert bot.send_message.call_args.args == (linked_account.chat_id, "42 €.")

    def test_history_flows_on_second_question(self, bot, monkeypatch, linked_account, household, user, settings):
        settings.TELEGRAM_COOLDOWN_SECONDS = 0
        ask = _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(linked_account.chat_id, "question 1", update_id=1))
        service.handle_update(text_update(linked_account.chat_id, "question 2", update_id=2))

        history = ask.call_args.kwargs["history"]
        assert [h["role"] for h in history] == ["user", "agent"]
        assert history[0]["content"] == "question 1"
        assert _channel_conversation(household, user).count() == 1

    def test_answer_with_citation_links_to_frontend(self, bot, monkeypatch, linked_account, settings):
        settings.FRONTEND_URL = "https://house.example.com"
        citation = Citation(
            entity_type="task", id="7", label="VMC", snippet="", url_path="/app/tasks/7"
        )
        _patch_ask(
            monkeypatch, return_value=_answer('Voilà <cite id="task:7"/>.', [citation])
        )
        service.handle_update(text_update(linked_account.chat_id, "où ça ?"))
        sent = bot.send_message.call_args.args[1]
        assert '<a href="https://house.example.com/app/tasks/7">' in sent

    def test_llm_error_sends_apology_and_persists_nothing(self, bot, monkeypatch, linked_account, household, user):
        _patch_ask(monkeypatch, side_effect=LLMTimeoutError("slow"))
        service.handle_update(text_update(linked_account.chat_id, "hello ?"))
        assert bot.send_message.call_count == 1
        assert AgentMessage.objects.count() == 0

    def test_unexpected_error_sends_generic_reply(self, bot, monkeypatch, linked_account):
        _patch_ask(monkeypatch, side_effect=RuntimeError("boom"))
        service.handle_update(text_update(linked_account.chat_id, "hello ?"))
        assert bot.send_message.call_count == 1

    def test_user_without_household_gets_explained(self, bot, monkeypatch, db):
        from accounts.tests.factories import UserFactory
        from telegram.linking import link_account

        lonely = UserFactory(email="tg-lonely@example.com")
        account = link_account(lonely, chat_id=424242)
        ask = _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(account.chat_id, "hello ?"))
        ask.assert_not_called()
        assert bot.send_message.call_count == 1


class TestCooldown:
    def test_burst_costs_one_llm_call(self, bot, monkeypatch, linked_account):
        ask = _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(linked_account.chat_id, "q1", update_id=1))
        service.handle_update(text_update(linked_account.chat_id, "q2", update_id=2))
        assert ask.call_count == 1
        # q1 answer + cooldown notice for q2
        assert bot.send_message.call_count == 2

    def test_cooldown_disabled_when_zero(self, bot, monkeypatch, linked_account, settings):
        settings.TELEGRAM_COOLDOWN_SECONDS = 0
        ask = _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(linked_account.chat_id, "q1", update_id=1))
        service.handle_update(text_update(linked_account.chat_id, "q2", update_id=2))
        assert ask.call_count == 2


class TestReset:
    def test_reset_opens_fresh_conversation_without_deleting(
        self, bot, monkeypatch, linked_account, household, user
    ):
        _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(linked_account.chat_id, "question", update_id=1))
        first = _channel_conversation(household, user).get()

        service.handle_update(text_update(linked_account.chat_id, "/reset", update_id=2))

        # Non-destructive: the old conversation stays, a fresh empty one is opened.
        convs = _channel_conversation(household, user)
        assert convs.count() == 2
        assert convs.filter(pk=first.pk).exists()
        fresh = convs.exclude(pk=first.pk).get()
        assert not fresh.messages.exists()
        # Answer + reset confirmation.
        assert bot.send_message.call_count == 2

    def test_reset_without_conversation_is_fine(self, bot, linked_account):
        service.handle_update(text_update(linked_account.chat_id, "/reset"))
        assert bot.send_message.call_count == 1

    def test_reset_twice_reuses_the_empty_fresh_conversation(
        self, bot, monkeypatch, linked_account, household, user
    ):
        _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(linked_account.chat_id, "question", update_id=1))
        service.handle_update(text_update(linked_account.chat_id, "/reset", update_id=2))
        service.handle_update(text_update(linked_account.chat_id, "/reset", update_id=3))

        # The second reset reuses the still-empty conversation — no pile-up.
        assert _channel_conversation(household, user).count() == 2

    def test_message_after_reset_threads_into_the_fresh_conversation(
        self, bot, monkeypatch, linked_account, household, user, settings
    ):
        settings.TELEGRAM_COOLDOWN_SECONDS = 0
        _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(linked_account.chat_id, "q1", update_id=1))
        first = _channel_conversation(household, user).get()
        service.handle_update(text_update(linked_account.chat_id, "/reset", update_id=2))
        service.handle_update(text_update(linked_account.chat_id, "q2", update_id=3))

        first.refresh_from_db()
        assert [m.content for m in first.messages.all()] == ["q1", "Réponse."]
        fresh = _channel_conversation(household, user).exclude(pk=first.pk).get()
        assert "q2" in [m.content for m in fresh.messages.all()]


class TestSessionGrouping:
    def test_stale_session_opens_a_new_conversation(
        self, bot, monkeypatch, linked_account, household, user, settings
    ):
        settings.TELEGRAM_COOLDOWN_SECONDS = 0
        _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(linked_account.chat_id, "q1", update_id=1))
        conv = _channel_conversation(household, user).get()
        # Simulate the session being from a previous day.
        AgentConversation.objects.filter(pk=conv.pk).update(
            last_message_at=timezone.now() - timedelta(days=1)
        )

        service.handle_update(text_update(linked_account.chat_id, "q2", update_id=2))

        # A fresh session is opened rather than reusing yesterday's.
        assert _channel_conversation(household, user).count() == 2

    def test_fresh_session_history_is_empty(
        self, bot, monkeypatch, linked_account, household, user, settings
    ):
        settings.TELEGRAM_COOLDOWN_SECONDS = 0
        ask = _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(linked_account.chat_id, "q1", update_id=1))
        conv = _channel_conversation(household, user).get()
        AgentConversation.objects.filter(pk=conv.pk).update(
            last_message_at=timezone.now() - timedelta(days=1)
        )
        service.handle_update(text_update(linked_account.chat_id, "q2", update_id=2))

        # The second ask sees no history — the new session starts clean.
        assert ask.call_args.kwargs["history"] == []
