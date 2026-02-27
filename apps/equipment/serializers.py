from rest_framework import serializers

from .models import Equipment, EquipmentInteraction


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = [
            "id",
            "household",
            "zone",
            "name",
            "category",
            "manufacturer",
            "model",
            "serial_number",
            "purchase_date",
            "purchase_price",
            "purchase_vendor",
            "warranty_expires_on",
            "warranty_provider",
            "warranty_notes",
            "maintenance_interval_months",
            "last_service_at",
            "status",
            "condition",
            "installed_at",
            "retired_at",
            "notes",
            "tags",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]


class EquipmentInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentInteraction
        fields = ["equipment", "interaction", "role", "note", "created_at", "created_by"]
        read_only_fields = ["created_at", "created_by"]
