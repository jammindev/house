# electricity/serializers.py
"""Electricity serializers."""

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from households.models import HouseholdMember

from .models import (
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    MaintenanceEvent,
    PlanChangeLog,
    ProtectiveDevice,
    UsagePoint,
    SupplyType,
)




def label_exists_elsewhere(label: str, household_id, current_instance):
    models_to_scan = (ElectricityBoard, ProtectiveDevice, ElectricCircuit, UsagePoint)
    for model in models_to_scan:
        qs = model.objects.filter(household_id=household_id, label=label)
        if current_instance is not None and isinstance(current_instance, model):
            qs = qs.exclude(id=current_instance.id)
        if qs.exists():
            return True
    return False


class HouseholdScopedModelSerializer(serializers.ModelSerializer):
    """Base serializer with shared household validation helpers."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = getattr(self, "instance", None)

        if instance is not None and "household" in attrs and attrs["household"].id != instance.household_id:
            raise serializers.ValidationError({"household": _("Household cannot be changed.")})

        household_id = attrs.get("household_id")
        if not household_id and instance is not None:
            household_id = getattr(instance, "household_id", None)
        if not household_id:
            request = self.context.get("request")
            if request is not None:
                selected_household = request.household
                if selected_household is not None:
                    household_id = selected_household.id

        label = attrs.get("label")
        if label and household_id and label_exists_elsewhere(label, household_id, instance):
            raise serializers.ValidationError({"label": _("Label must be unique across electricity entities in household.")})

        return attrs


class ElectricityBoardSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = ElectricityBoard
        fields = [
            "id",
            "household",
            "label",
            "parent",
            "zone",
            "name",
            "supply_type",
            "location",
            "rows",
            "slots_per_row",
            "last_inspection_date",
            "nf_c_15100_compliant",
            "main_notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        if request is None:
            return attrs

        selected_household = request.household
        if selected_household is None:
            return attrs

        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))

        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        zone = attrs.get("zone") if "zone" in attrs else getattr(self.instance, "zone", None)

        if parent and parent.household_id != selected_household.id:
            raise serializers.ValidationError({"parent": _("Parent board must belong to the same household.")})
        if zone is None:
            raise serializers.ValidationError({"zone": _("Zone is required.")})
        if zone.household_id != selected_household.id:
            raise serializers.ValidationError({"zone": _("Zone must belong to the same household.")})

        if not is_active:
            return attrs

        # Resolve the parent: use incoming value, fall back to existing instance value
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        if parent is not None:
            # Sub-boards are not subject to the one-active-root constraint
            return attrs

        existing_active_root = (
            ElectricityBoard.objects.for_household(selected_household.id)
            .filter(is_active=True, parent__isnull=True)
        )
        if self.instance is not None:
            existing_active_root = existing_active_root.exclude(id=self.instance.id)

        if existing_active_root.exists():
            raise serializers.ValidationError(
                {"is_active": _("Only one active root board is allowed per household.")}
            )

        return attrs


class ProtectiveDeviceSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = ProtectiveDevice
        fields = [
            "id",
            "household",
            "board",
            "parent_rcd",
            "label",
            "device_type",
            "role",
            "row",
            "position",
            "phase",
            "rating_amps",
            "curve_type",
            "sensitivity_ma",
            "type_code",
            "phase_coverage",
            "brand",
            "model_ref",
            "installed_at",
            "is_spare",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        board = attrs.get("board") or getattr(self.instance, "board", None)
        parent_rcd = attrs.get("parent_rcd") if "parent_rcd" in attrs else getattr(self.instance, "parent_rcd", None)
        household = attrs.get("household") or getattr(self.instance, "household", None)
        phase = attrs.get("phase", getattr(self.instance, "phase", None))
        device_type = attrs.get("device_type", getattr(self.instance, "device_type", None))
        phase_coverage = attrs.get("phase_coverage", getattr(self.instance, "phase_coverage", None))

        if board and household and board.household_id != household.id:
            raise serializers.ValidationError({"board": _("Board must belong to the same household.")})
        if parent_rcd and household and parent_rcd.household_id != household.id:
            raise serializers.ValidationError({"parent_rcd": _("Parent device must belong to the same household.")})

        if board:
            if board.supply_type == SupplyType.SINGLE_PHASE and phase:
                raise serializers.ValidationError({"phase": _("Phase must be empty for single-phase board.")})
            if board.supply_type == SupplyType.THREE_PHASE and device_type in ("breaker", "combined", "main") and not phase:
                raise serializers.ValidationError({"phase": _("Phase is required for three-phase board.")})
            if board.supply_type == SupplyType.SINGLE_PHASE and device_type == "rcd" and phase_coverage:
                raise serializers.ValidationError({"phase_coverage": _("phase_coverage must be null for single-phase board.")})

        return attrs


class ElectricCircuitSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = ElectricCircuit
        fields = [
            "id",
            "household",
            "board",
            "protective_device",
            "label",
            "name",
            "phase",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        board = attrs.get("board") or getattr(self.instance, "board", None)
        protective_device = attrs.get("protective_device") or getattr(self.instance, "protective_device", None)
        household = attrs.get("household") or getattr(self.instance, "household", None)
        phase = attrs.get("phase", getattr(self.instance, "phase", None))

        if protective_device and household and protective_device.household_id != household.id:
            raise serializers.ValidationError({"protective_device": _("Protective device must belong to the same household.")})
        if protective_device and protective_device.device_type == "rcd":
            raise serializers.ValidationError(
                {"protective_device": _("A circuit cannot be directly protected by a pure RCD (device_type=rcd).")}
            )
        if board and protective_device and board.id != protective_device.board_id:
            raise serializers.ValidationError({"protective_device": _("Protective device must belong to the selected board.")})

        if board and board.supply_type == SupplyType.THREE_PHASE and not phase:
            raise serializers.ValidationError({"phase": _("Phase is required for three-phase board.")})
        if board and board.supply_type == SupplyType.SINGLE_PHASE and phase:
            raise serializers.ValidationError({"phase": _("Phase must be empty for single-phase board.")})

        return attrs


class UsagePointSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = UsagePoint
        fields = [
            "id",
            "household",
            "label",
            "name",
            "kind",
            "zone",
            "max_power_watts",
            "is_dedicated_circuit",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        zone = attrs.get("zone") if "zone" in attrs else getattr(self.instance, "zone", None)
        household = attrs.get("household") or getattr(self.instance, "household", None)
        if zone is None:
            raise serializers.ValidationError({"zone": _("Zone is required.")})
        if household and zone.household_id != household.id:
            raise serializers.ValidationError({"zone": _("Zone must belong to the same household.")})
        return attrs


class CircuitUsagePointLinkSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = CircuitUsagePointLink
        fields = [
            "id",
            "household",
            "circuit",
            "usage_point",
            "is_active",
            "deactivated_at",
            "deactivated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "deactivated_at", "deactivated_by", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        circuit = attrs.get("circuit") or getattr(self.instance, "circuit", None)
        usage_point = attrs.get("usage_point") or getattr(self.instance, "usage_point", None)
        household = attrs.get("household") or getattr(self.instance, "household", None)
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))

        if household and circuit and circuit.household_id != household.id:
            raise serializers.ValidationError({"circuit": _("Circuit must belong to the same household.")})
        if household and usage_point and usage_point.household_id != household.id:
            raise serializers.ValidationError({"usage_point": _("Usage point must belong to the same household.")})
        if circuit and usage_point and circuit.household_id != usage_point.household_id:
            raise serializers.ValidationError({"usage_point": _("Usage point and circuit must be in the same household.")})

        if usage_point and is_active:
            conflict_qs = CircuitUsagePointLink.objects.filter(usage_point=usage_point, is_active=True)
            if self.instance is not None:
                conflict_qs = conflict_qs.exclude(id=self.instance.id)
            if conflict_qs.exists():
                raise serializers.ValidationError({"usage_point": _("Usage point already has an active circuit link.")})

        return attrs


class MaintenanceEventSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = MaintenanceEvent
        fields = [
            "id",
            "household",
            "board",
            "performed_by",
            "event_date",
            "description",
            "entity_type",
            "entity_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        board = attrs.get("board") if "board" in attrs else getattr(self.instance, "board", None)
        household = getattr(self.instance, "household", None)
        if household is None:
            request = self.context.get("request")
            if request is not None:
                household = request.household
        if board and household and board.household_id != household.id:
            raise serializers.ValidationError({"board": _("Board must belong to the same household.")})
        return attrs


class PlanChangeLogSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = PlanChangeLog
        fields = [
            "id",
            "household",
            "actor",
            "action",
            "entity_type",
            "entity_id",
            "payload",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        actor = attrs.get("actor") or getattr(self.instance, "actor", None)
        household = attrs.get("household") or getattr(self.instance, "household", None)
        if actor is None:
            raise serializers.ValidationError({"actor": _("Actor is required.")})
        if household and not HouseholdMember.objects.filter(household=household, user=actor).exists():
            raise serializers.ValidationError({"actor": _("Actor must be a member of the household.")})
        return attrs
