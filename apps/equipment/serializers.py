from rest_framework import serializers
from django.utils.translation import gettext_lazy as _

from .models import Equipment, EquipmentInteraction
from .services import compute_next_service_due


class EquipmentSerializer(serializers.ModelSerializer):
    next_service_due = serializers.SerializerMethodField()
    zone_name = serializers.CharField(source="zone.name", read_only=True)

    class Meta:
        model = Equipment
        fields = [
            "id",
            "household",
            "zone",
            "zone_name",
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
            "next_service_due",
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
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by", "updated_by"]

    def get_next_service_due(self, obj):
        return compute_next_service_due(obj.last_service_at, obj.maintenance_interval_months)

    def validate_zone(self, value):
        if value is None:
            return value

        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return value

        if not value.household.householdmember_set.filter(user=request.user).exists():
            raise serializers.ValidationError(_("Invalid zone or access denied."))

        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        zone = attrs.get("zone")
        household = getattr(self.instance, "household", None)
        if household is None:
            household = attrs.get("household")
        if household is None:
            request = self.context.get("request")
            if request is not None:
                household = request.household

        if zone and household and zone.household_id != household.id:
            raise serializers.ValidationError({"zone": _("Zone must belong to the same household as equipment.")})

        return attrs


class EquipmentInteractionSerializer(serializers.ModelSerializer):
    interaction_subject = serializers.CharField(source="interaction.subject", read_only=True)
    interaction_type = serializers.CharField(source="interaction.type", read_only=True)
    interaction_status = serializers.CharField(source="interaction.status", read_only=True)
    interaction_occurred_at = serializers.DateTimeField(source="interaction.occurred_at", read_only=True)

    class Meta:
        model = EquipmentInteraction
        fields = [
            "equipment",
            "interaction",
            "interaction_subject",
            "interaction_type",
            "interaction_status",
            "interaction_occurred_at",
            "role",
            "note",
            "created_at",
            "created_by",
        ]
        read_only_fields = ["created_at", "created_by"]
