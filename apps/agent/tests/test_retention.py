"""Tests for agent conversation retention (helper + management command)."""
from __future__ import annotations

from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from accounts.tests.factories import UserFactory
from agent.models import AgentConversation, AgentMessage
from agent.retention import delete_stale_conversations
from households.models import Household, HouseholdMember


@pytest.fixture
def owner(db):
    return UserFactory(email="retention-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Retention House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


def _conversation(household, owner, *, last_message_days_ago=None, created_days_ago=0):
    conv = AgentConversation.objects.create(household=household, created_by=owner)
    now = timezone.now()
    updates = {}
    if created_days_ago:
        updates["created_at"] = now - timedelta(days=created_days_ago)
    if last_message_days_ago is not None:
        updates["last_message_at"] = now - timedelta(days=last_message_days_ago)
    if updates:
        AgentConversation.objects.filter(pk=conv.pk).update(**updates)
        conv.refresh_from_db()
    return conv


class TestDeleteStaleConversations:
    def test_deletes_by_last_message_at(self, household, owner):
        old = _conversation(household, owner, last_message_days_ago=400)
        recent = _conversation(household, owner, last_message_days_ago=10)

        deleted = delete_stale_conversations(365)

        assert deleted == 1
        assert not AgentConversation.objects.filter(pk=old.pk).exists()
        assert AgentConversation.objects.filter(pk=recent.pk).exists()

    def test_falls_back_to_created_at_when_never_messaged(self, household, owner):
        # No last_message_at → the created_at date decides.
        stale = _conversation(household, owner, created_days_ago=400)
        fresh = _conversation(household, owner, created_days_ago=5)

        deleted = delete_stale_conversations(365)

        assert deleted == 1
        assert not AgentConversation.objects.filter(pk=stale.pk).exists()
        assert AgentConversation.objects.filter(pk=fresh.pk).exists()

    def test_cascade_removes_messages(self, household, owner):
        conv = _conversation(household, owner, last_message_days_ago=400)
        AgentMessage.objects.create(
            conversation=conv, role=AgentMessage.Role.USER, content="q"
        )
        delete_stale_conversations(365)
        assert AgentMessage.objects.count() == 0

    def test_dry_run_deletes_nothing(self, household, owner):
        _conversation(household, owner, last_message_days_ago=400)
        deleted = delete_stale_conversations(365, dry_run=True)
        assert deleted == 1
        assert AgentConversation.objects.count() == 1

    def test_zero_retention_is_a_noop(self, household, owner):
        _conversation(household, owner, last_message_days_ago=9999)
        assert delete_stale_conversations(0) == 0
        assert AgentConversation.objects.count() == 1


class TestCommand:
    def test_uses_settings_default(self, settings, household, owner):
        settings.AGENT_CONVERSATION_RETENTION_DAYS = 365
        _conversation(household, owner, last_message_days_ago=400)
        out = StringIO()
        call_command("cleanup_agent_conversations", stdout=out)
        assert "Deleted 1" in out.getvalue()
        assert AgentConversation.objects.count() == 0

    def test_days_override(self, settings, household, owner):
        settings.AGENT_CONVERSATION_RETENTION_DAYS = 365
        _conversation(household, owner, last_message_days_ago=100)
        out = StringIO()
        call_command("cleanup_agent_conversations", "--days", "90", stdout=out)
        assert AgentConversation.objects.count() == 0

    def test_dry_run(self, settings, household, owner):
        settings.AGENT_CONVERSATION_RETENTION_DAYS = 365
        _conversation(household, owner, last_message_days_ago=400)
        out = StringIO()
        call_command("cleanup_agent_conversations", "--dry-run", stdout=out)
        assert "[dry-run]" in out.getvalue()
        assert AgentConversation.objects.count() == 1

    def test_zero_days_disables(self, settings, household, owner):
        settings.AGENT_CONVERSATION_RETENTION_DAYS = 0
        _conversation(household, owner, last_message_days_ago=9999)
        out = StringIO()
        call_command("cleanup_agent_conversations", stdout=out)
        assert "disabled" in out.getvalue().lower()
        assert AgentConversation.objects.count() == 1

    def test_negative_days_errors(self, household, owner):
        with pytest.raises(CommandError):
            call_command("cleanup_agent_conversations", "--days", "-5")
