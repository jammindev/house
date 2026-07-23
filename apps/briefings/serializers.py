"""Briefing serializers — validation shared by the REST viewset and services."""
from rest_framework import serializers

from .models import Briefing


class BriefingSerializer(serializers.ModelSerializer):
    """Read/write serializer for a briefing rule.

    ``created_by`` is the creator (owner of a private briefing). It is set by the
    service on create and never rewritten, so it is read-only here.
    """

    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Briefing
        fields = [
            "id",
            "household",
            "title",
            "prompt",
            "condition",
            "channel",
            "briefing_type",
            "is_private",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = [
            "id",
            "household",
            "created_at",
            "updated_at",
            "created_by",
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by_id and obj.created_by else None

    def validate_title(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("A title is required.")
        return value

    def validate_prompt(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("A prompt is required.")
        return value

    def validate_condition(self, value):
        return (value or "").strip()
