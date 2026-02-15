from rest_framework import serializers

from .models import Tag, InteractionTag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = [
            "id",
            "household",
            "type",
            "name",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]


class InteractionTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = InteractionTag
        fields = ["interaction", "tag", "created_at", "created_by"]
        read_only_fields = ["created_at", "created_by"]
