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
from django.db.models.functions import Coalesce

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel, TimestampedModel


class AgentConversation(HouseholdScopedModel):
    """An ordered thread of messages between a user and the agent."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, blank=True, default="")
    # Mirrors the newest message's timestamp so conversations sort by recency
    # without a subquery. Kept in sync when a message is appended.
    last_message_at = models.DateTimeField(null=True, blank=True)

    # Optional anchor to a household entity (e.g. a project). When set, every
    # `ask` on this conversation pre-injects that entity's full context so the
    # agent already knows it without searching. The pair mirrors the agent's
    # string-based entity addressing (`entity_type:id`, see agent.searchables /
    # agent.tools) so any registered searchable can anchor a conversation.
    context_entity_type = models.CharField(max_length=64, blank=True, default="")
    context_object_id = models.CharField(max_length=64, blank=True, default="")

    # Extra household entities the user asked the agent to keep in mind, on top
    # of the anchor. Each entry is ``{"entity_type": str, "object_id": str}`` —
    # same string addressing as the anchor. Every `ask` pre-injects each pinned
    # entity's full context (item + linked items), exactly like the anchor. The
    # UI shows them as removable chips in the "what I know" panel. Kept as a JSON
    # list rather than a table: it is a small, order-preserving set of pointers,
    # never queried or constrained on its own (mirrors the anchor's design).
    pinned_contexts = models.JSONField(default=list, blank=True)

    # Per-conversation arming of the agent's web search. The server-side tool is
    # only ever offered when the instance capability is on
    # (settings.AGENT_WEB_SEARCH_ENABLED) AND this flag is set — the user arms it,
    # the agent still decides *when* to search. Off by default (cost-conscious).
    # Persisted so the toggle survives reloads / syncs across the user's devices.
    web_search_enabled = models.BooleanField(default=False)

    objects = HouseholdScopedManager()

    class Meta:
        # Recency = last activity. Coalesce avoids Postgres putting NULLs
        # (conversations without any message yet) first on a plain DESC sort:
        # an empty conversation sorts by its creation time instead of floating
        # to the top forever.
        ordering = [Coalesce("last_message_at", "created_at").desc(), "-created_at"]

    def __str__(self) -> str:
        return self.title or f"Conversation {self.pk}"

    @property
    def has_context(self) -> bool:
        """True when this conversation is anchored to a household entity."""
        return bool(self.context_entity_type and self.context_object_id)


class AgentMemory(HouseholdScopedModel):
    """A durable fact the agent knows about ONE user, learned from conversations.

    This is the agent's memory of the USER (preferences, habits, personal
    context — "prefers gardening on weekends"), not household data: household
    facts already live in their own models and always win over a memory in case
    of conflict. Scope: per (household, created_by) — memories are private to
    the user who talked to the agent and are never shared between members.

    Like conversations, memories are NOT registered in ``agent.searchables``:
    they are injected verbatim into the system prompt, never retrieved/cited.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content = models.TextField(max_length=500)

    objects = HouseholdScopedManager()

    class Meta:
        ordering = ["-updated_at"]
        verbose_name_plural = "agent memories"

    def __str__(self) -> str:
        return (self.content or "").strip()[:60]


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
