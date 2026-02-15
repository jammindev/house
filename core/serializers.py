from rest_framework import serializers

from .models import SystemAdmin


class SystemAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemAdmin
        fields = [
            "id",
            "user",
            "role",
            "granted_by",
            "granted_at",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "granted_by", "granted_at", "created_at", "updated_at"]
