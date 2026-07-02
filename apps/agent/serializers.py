"""Serializers for the agent API."""
from __future__ import annotations

from rest_framework import serializers

from .models import AgentConversation, AgentMessage


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
    """Lightweight row for the conversation list (no messages)."""

    message_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = AgentConversation
        fields = ["id", "title", "last_message_at", "created_at", "message_count"]
        read_only_fields = ["id", "last_message_at", "created_at", "message_count"]


class ConversationDetailSerializer(serializers.ModelSerializer):
    """Full conversation with its ordered messages. `title` writable on create.

    ``context_entity_type`` / ``context_object_id`` anchor the conversation to a
    household entity (write-on-create only): every ask then pre-injects that
    entity's context. Left blank for a plain, unanchored conversation.
    """

    messages = AgentMessageSerializer(many=True, read_only=True)

    class Meta:
        model = AgentConversation
        fields = [
            "id",
            "title",
            "last_message_at",
            "created_at",
            "context_entity_type",
            "context_object_id",
            "messages",
        ]
        read_only_fields = ["id", "last_message_at", "created_at", "messages"]


class ConversationUpdateSerializer(serializers.ModelSerializer):
    """Rename only — the title is the sole user-editable field."""

    class Meta:
        model = AgentConversation
        fields = ["id", "title"]
        read_only_fields = ["id"]


class PostMessageSerializer(serializers.Serializer):
    question = serializers.CharField(min_length=1, max_length=2000, trim_whitespace=True)
