from rest_framework import serializers

from .models import Structure


class StructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Structure
        fields = [
            "id",
            "household",
            "name",
            "type",
            "description",
            "website",
            "tags",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]
