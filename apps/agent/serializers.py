"""Serializers for the agent API."""
from __future__ import annotations

from rest_framework import serializers


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
