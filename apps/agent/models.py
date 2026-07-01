"""
Conversation persistence for the agent.

`AgentConversation` groups an ordered thread of `AgentMessage` rows so the agent
can be multi-turn: follow-ups like "et ce document ?" resolve against previous
turns instead of starting from a blank session each time.

Scope: a conversation belongs to a household (via `HouseholdScopedModel`) and to
the user who created it (`created_by`) — conversations are private per user.

These models are **not** registered in `agent.searchables`: they are the agent's
own transcript, not household knowledge, and must never surface in retrieval.
"""
from __future__ import annotations

import uuid

from django.db import models

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel, TimestampedModel


class AgentConversation(HouseholdScopedModel):
    """An ordered thread of messages between a user and the agent."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, blank=True, default="")
    # Mirrors the newest message's timestamp so conversations sort by recency
    # without a subquery. Kept in sync when a message is appended.
    last_message_at = models.DateTimeField(null=True, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        ordering = ["-last_message_at", "-created_at"]

    def __str__(self) -> str:
        return self.title or f"Conversation {self.pk}"


class AgentMessage(TimestampedModel):
    """A single turn in a conversation (a user question or an agent answer)."""

    class Role(models.TextChoices):
        USER = "user", "User"
        AGENT = "agent", "Agent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        AgentConversation,
        on_delete=models.CASCADE,
        related_name="messages",
        db_column="conversation_id",
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField(blank=True, default="")
    # Agent answers carry their resolved citations + call metadata (tokens,
    # model, duration) so a reloaded conversation re-renders exactly as served.
    citations = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        preview = (self.content or "").strip()[:40]
        return f"{self.role}: {preview}"
