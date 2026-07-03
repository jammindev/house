"""Tests for the agent conversation models."""
from __future__ import annotations

import pytest

from accounts.tests.factories import UserFactory
from agent.models import AgentConversation, AgentMessage
from households.models import Household, HouseholdMember


@pytest.fixture
def owner(db):
    return UserFactory(email="agent-models-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Conv House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def conversation(household, owner):
    return AgentConversation.objects.create(household=household, created_by=owner)


class TestAgentConversation:
    def test_requires_household(self, owner):
        with pytest.raises(ValueError):
            AgentConversation(created_by=owner).save()

    def test_defaults(self, conversation):
        assert conversation.title == ""
        assert conversation.last_message_at is None
        assert conversation.id is not None

    def test_str_uses_title_then_fallback(self, household, owner):
        untitled = AgentConversation.objects.create(household=household, created_by=owner)
        assert str(untitled).startswith("Conversation ")
        titled = AgentConversation.objects.create(
            household=household, created_by=owner, title="Chaudière"
        )
        assert str(titled) == "Chaudière"

    def test_orders_by_recency(self, household, owner):
        from django.utils import timezone

        older = AgentConversation.objects.create(
            household=household, created_by=owner, title="old",
            last_message_at=timezone.now() - timezone.timedelta(hours=2),
        )
        newer = AgentConversation.objects.create(
            household=household, created_by=owner, title="new",
            last_message_at=timezone.now(),
        )
        ordered = list(AgentConversation.objects.all())
        assert ordered.index(newer) < ordered.index(older)

    def test_empty_conversation_sorts_by_created_at_not_first(self, household, owner):
        """A conversation without messages (last_message_at NULL) must not float
        above recently-active ones (Postgres puts NULLs first on DESC)."""
        from django.utils import timezone

        stale_empty = AgentConversation.objects.create(
            household=household, created_by=owner, title="stale empty"
        )
        AgentConversation.objects.filter(pk=stale_empty.pk).update(
            created_at=timezone.now() - timezone.timedelta(days=3)
        )
        active = AgentConversation.objects.create(
            household=household, created_by=owner, title="active",
            last_message_at=timezone.now(),
        )
        ordered = list(AgentConversation.objects.all())
        assert ordered.index(active) < ordered.index(stale_empty)


class TestAgentMessage:
    def test_create_and_order_by_created_at(self, conversation):
        m1 = AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.USER, content="Q1"
        )
        m2 = AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.AGENT, content="A1"
        )
        ordered = list(conversation.messages.all())
        assert ordered == [m1, m2]

    def test_json_defaults(self, conversation):
        msg = AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.USER, content="hi"
        )
        assert msg.citations == []
        assert msg.metadata == {}

    def test_stores_citations_and_metadata(self, conversation):
        msg = AgentMessage.objects.create(
            conversation=conversation,
            role=AgentMessage.Role.AGENT,
            content="answer",
            citations=[{"entity_type": "document", "id": "abc", "label": "Facture"}],
            metadata={"model": "claude-haiku-4-5", "tokens_in": 120},
        )
        msg.refresh_from_db()
        assert msg.citations[0]["label"] == "Facture"
        assert msg.metadata["tokens_in"] == 120

    def test_cascade_delete_with_conversation(self, conversation):
        AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.USER, content="Q"
        )
        conversation.delete()
        assert AgentMessage.objects.count() == 0

    def test_str_truncates_content(self, conversation):
        msg = AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.USER, content="x" * 100
        )
        assert msg.role in str(msg)
        assert len(str(msg)) < 60
