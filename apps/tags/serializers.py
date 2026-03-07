from rest_framework import serializers

from .models import Tag, TagLink


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
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by", "updated_by"]


class TagLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = TagLink
        fields = [
            "id",
            "household",
            "tag",
            "content_type",
            "object_id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by", "updated_by"]
