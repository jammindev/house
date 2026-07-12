"""Proactive outbound: deliver first, then persist in the channel conversation."""
from __future__ import annotations

from unittest import mock

import pytest

from agent.models import AgentConversation, AgentMessage
from telegram import service
from telegram.outbound import send_agent_message

pytestmark = pytest.mark.django_db


@pytest.fixture
def outbound_client(monkeypatch):
    client = mock.Mock()
    client.enabled = True
    client.send_message.return_value = {"message_id": 42}
    monkeypatch.setattr("telegram.outbound.get_client", lambda: client)
    return client


def _channel_conversation(household, user):
    return AgentConversation.objects.filter(
        household=household,
        created_by=user,
        context_entity_type=service.CHANNEL_ENTITY_TYPE,
        context_object_id=service.CHANNEL_OBJECT_ID,
    )


class TestSendAgentMessage:
    def test_delivers_and_persists_assistant_turn(self, outbound_client, linked_account,
                                                  household, user):
        ok = send_agent_message(linked_account, household, "🥚 Combien d'œufs ?")

        assert ok is True
        outbound_client.send_message.assert_called_once_with(
            linked_account.chat_id, "🥚 Combien d'œufs ?"
        )
        conversation = _channel_conversation(household, user).get()
        message = conversation.messages.get()
        assert message.role == AgentMessage.Role.AGENT
        assert message.content == "🥚 Combien d'œufs ?"
        assert conversation.title  # auto-titled from the ping
        assert conversation.last_message_at is not None

    def test_reuses_the_existing_channel_conversation(self, outbound_client,
                                                      linked_account, household, user):
        conversation = AgentConversation.objects.create(
            household=household,
            created_by=user,
            context_entity_type=service.CHANNEL_ENTITY_TYPE,
            context_object_id=service.CHANNEL_OBJECT_ID,
            title="Déjà là",
        )
        send_agent_message(linked_account, household, "Question ?")

        assert _channel_conversation(household, user).count() == 1
        conversation.refresh_from_db()
        assert conversation.title == "Déjà là"  # never overwritten
        assert conversation.messages.count() == 1

    def test_failed_delivery_persists_nothing(self, outbound_client, linked_account,
                                              household, user):
        outbound_client.send_message.return_value = None

        ok = send_agent_message(linked_account, household, "Question ?")

        assert ok is False
        assert not _channel_conversation(household, user).exists()
        assert not AgentMessage.objects.exists()
