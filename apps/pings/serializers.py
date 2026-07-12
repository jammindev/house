"""Serializers for the proactive-pings preferences API."""
from __future__ import annotations

from rest_framework import serializers


class PingRowSerializer(serializers.Serializer):
    """One available ping merged with the user's preference (read shape)."""

    ping_type = serializers.CharField()
    module = serializers.CharField(allow_null=True)
    enabled = serializers.BooleanField()
    send_at = serializers.TimeField(format="%H:%M")


class PingUpdateSerializer(serializers.Serializer):
    """PUT body — ``send_at`` is optional so a plain toggle keeps the time."""

    enabled = serializers.BooleanField()
    send_at = serializers.TimeField(required=False)
