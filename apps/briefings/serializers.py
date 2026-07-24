"""Briefing serializers — validation shared by the REST viewset and services."""
from rest_framework import serializers

from .models import Briefing, BriefingSendLog
from .schedule import next_send_at, validate_schedule


class BriefingSendLogSerializer(serializers.ModelSerializer):
    """One line of a briefing's send history (lot 5).

    ``content`` is dual-purpose by status: the sent message when ``sent``, the
    skip reason when ``skipped_condition``, empty on ``error`` — the UI labels it
    accordingly.
    """

    user_name = serializers.SerializerMethodField()

    class Meta:
        model = BriefingSendLog
        fields = [
            "id",
            "status",
            "content",
            "slot_date",
            "slot_time",
            "user",
            "user_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_user_name(self, obj):
        return obj.user.full_name if obj.user_id and obj.user else None


class BriefingSerializer(serializers.ModelSerializer):
    """Read/write serializer for a briefing rule.

    ``created_by`` is the creator (owner of a private briefing). It is set by the
    service on create and never rewritten, so it is read-only here.
    """

    created_by_name = serializers.SerializerMethodField()
    send_times = serializers.ListField(
        child=serializers.TimeField(), required=False
    )
    weekdays = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6), required=False
    )
    next_send_at = serializers.SerializerMethodField()
    last_send = serializers.SerializerMethodField()

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
            "send_times",
            "weekdays",
            "next_send_at",
            "last_send",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = [
            "id",
            "household",
            "next_send_at",
            "last_send",
            "created_at",
            "updated_at",
            "created_by",
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by_id and obj.created_by else None

    def get_next_send_at(self, obj):
        dt = next_send_at(obj)
        return dt.isoformat() if dt else None

    def get_last_send(self, obj):
        """Compact summary of the most recent send attempt, for the card glance."""
        log = obj.send_logs.order_by("-created_at").first()
        if log is None:
            return None
        return {
            "status": log.status,
            "content": log.content,
            "created_at": log.created_at.isoformat(),
        }

    def validate(self, attrs):
        """Cross-field checks: valid, spaced-out schedule; no activation without one."""

        def current(field, default):
            if field in attrs:
                return attrs[field]
            return getattr(self.instance, field, default) if self.instance else default

        send_times = current("send_times", [])
        weekdays = current("weekdays", [])
        is_active = current("is_active", False)

        try:
            validate_schedule(send_times, weekdays)
        except ValueError as exc:
            raise serializers.ValidationError({"send_times": str(exc)})

        if is_active and not send_times:
            raise serializers.ValidationError(
                {"is_active": "A send time is required to activate a briefing."}
            )
        return attrs

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
