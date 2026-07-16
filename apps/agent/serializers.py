"""Serializers for the agent API."""
from __future__ import annotations

import dataclasses

from rest_framework import serializers

from .context import describe_conversation_context
from .models import AgentConversation, AgentMemory, AgentMessage


class AskRequestSerializer(serializers.Serializer):
    question = serializers.CharField(min_length=1, max_length=2000, trim_whitespace=True)


class CitationSerializer(serializers.Serializer):
    entity_type = serializers.CharField()
    id = serializers.CharField()
    label = serializers.CharField()
    snippet = serializers.CharField(allow_blank=True)
    url_path = serializers.CharField()


class AskResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    citations = CitationSerializer(many=True)
    metadata = serializers.DictField()


# --- Conversations -----------------------------------------------------------


class AgentMessageSerializer(serializers.ModelSerializer):
    """A persisted turn — everything the UI needs to re-render it identically."""

    class Meta:
        model = AgentMessage
        fields = ["id", "role", "content", "citations", "metadata", "created_at"]
        read_only_fields = fields


class ConversationListSerializer(serializers.ModelSerializer):
    """Lightweight row for the conversation list (no messages).

    ``last_message_preview`` (the newest message's text, annotated in the view)
    lets the sidebar show a one-line snippet under the title — a recency cue à la
    ChatGPT/Claude without loading the whole thread.
    """

    message_count = serializers.IntegerField(read_only=True)
    last_message_preview = serializers.CharField(read_only=True, default="")

    class Meta:
        model = AgentConversation
        fields = [
            "id",
            "title",
            "last_message_at",
            "created_at",
            "message_count",
            "last_message_preview",
        ]
        read_only_fields = fields


class ConversationDetailSerializer(serializers.ModelSerializer):
    """Full conversation with its ordered messages. `title` writable on create.

    ``context_entity_type`` / ``context_object_id`` anchor the conversation to a
    household entity (write-on-create only): every ask then pre-injects that
    entity's context. Left blank for a plain, unanchored conversation.

    ``injected_context`` is the resolved, human-readable view of everything the
    agent currently knows about (anchor + linked items + user-pinned entities) —
    it mirrors exactly what ``ask`` pre-injects, so the UI "what I know" panel is
    honest by construction.
    """

    messages = AgentMessageSerializer(many=True, read_only=True)
    injected_context = serializers.SerializerMethodField()

    class Meta:
        model = AgentConversation
        fields = [
            "id",
            "title",
            "last_message_at",
            "created_at",
            "context_entity_type",
            "context_object_id",
            "injected_context",
            "messages",
        ]
        read_only_fields = ["id", "last_message_at", "created_at", "messages"]

    def get_injected_context(self, obj) -> list[dict]:
        return [
            dataclasses.asdict(item)
            for item in describe_conversation_context(obj, obj.household)
        ]


class ConversationUpdateSerializer(serializers.ModelSerializer):
    """Rename only — the title is the sole user-editable field."""

    class Meta:
        model = AgentConversation
        fields = ["id", "title"]
        read_only_fields = ["id"]


class PostMessageSerializer(serializers.Serializer):
    question = serializers.CharField(min_length=1, max_length=2000, trim_whitespace=True)


# --- User memory ---------------------------------------------------------------


class AgentMemorySerializer(serializers.ModelSerializer):
    """One durable fact the agent knows about the current user.

    Validation is shared: the ``manage_memory`` tool and the REST viewset both
    funnel writes through ``agent.memory``, which uses this serializer.
    """

    content = serializers.CharField(min_length=1, max_length=500, trim_whitespace=True)

    class Meta:
        model = AgentMemory
        fields = ["id", "content", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
