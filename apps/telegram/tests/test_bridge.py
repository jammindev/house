"""The agent bridge: linked question -> service.ask -> persisted turns -> reply."""
from __future__ import annotations

from unittest import mock

import pytest

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
    def test_reset_deletes_channel_conversation(self, bot, monkeypatch, linked_account, household, user):
        _patch_ask(monkeypatch, return_value=_answer())
        service.handle_update(text_update(linked_account.chat_id, "question", update_id=1))
        assert _channel_conversation(household, user).exists()

        service.handle_update(text_update(linked_account.chat_id, "/reset", update_id=2))
        assert not _channel_conversation(household, user).exists()
        # Reset confirmation was sent.
        assert bot.send_message.call_count == 2

    def test_reset_without_conversation_is_fine(self, bot, linked_account):
        service.handle_update(text_update(linked_account.chat_id, "/reset"))
        assert bot.send_message.call_count == 1
