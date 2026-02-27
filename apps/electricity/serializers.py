# electricity/serializers.py
"""Electricity serializers."""

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from core.permissions import resolve_request_household
from households.models import HouseholdMember

from .models import (
    Breaker,
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    PlanChangeLog,
    ResidualCurrentDevice,
    UsagePoint,
    SupplyType,
)


def label_exists_in_household(label: str, household_id):
    if not label or not household_id:
        return False

    return any(
        model.objects.filter(household_id=household_id, label=label).exists()
        for model in (ResidualCurrentDevice, Breaker, ElectricCircuit, UsagePoint)
    )


def label_exists_elsewhere(label: str, household_id, current_instance):
    models_to_scan = (ResidualCurrentDevice, Breaker, ElectricCircuit, UsagePoint)
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
                selected_household = resolve_request_household(request, required=False)
                if selected_household is not None:
                    household_id = selected_household.id

        label = attrs.get("label")
        if label and household_id and label_exists_elsewhere(label, household_id, instance):
            raise serializers.ValidationError({"label": _("Label must be unique across electricity entities in household.")})

        return attrs


class ElectricityBoardSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = ElectricityBoard
        fields = ["id", "household", "name", "supply_type", "main_notes", "is_active", "created_at", "updated_at"]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        if request is None:
            return attrs

        selected_household = resolve_request_household(request, required=False)
        if selected_household is None:
            return attrs

        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))
        if not is_active:
            return attrs

        existing_active = ElectricityBoard.objects.for_household(selected_household.id).filter(is_active=True)
        if self.instance is not None:
            existing_active = existing_active.exclude(id=self.instance.id)

        if existing_active.exists():
            raise serializers.ValidationError({"is_active": _("Only one active board is allowed per household.")})

        return attrs


class ResidualCurrentDeviceSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = ResidualCurrentDevice
        fields = [
            "id",
            "household",
            "board",
            "label",
            "rating_amps",
            "sensitivity_ma",
            "type_code",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        board = attrs.get("board") or getattr(self.instance, "board", None)
        household = attrs.get("household") or getattr(self.instance, "household", None)
        if board and household and board.household_id != household.id:
            raise serializers.ValidationError({"board": _("Board must belong to the same household.")})
        return attrs


class BreakerSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = Breaker
        fields = [
            "id",
            "household",
            "board",
            "rcd",
            "label",
            "rating_amps",
            "curve_type",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        board = attrs.get("board") or getattr(self.instance, "board", None)
        rcd = attrs.get("rcd") if "rcd" in attrs else getattr(self.instance, "rcd", None)
        household = attrs.get("household") or getattr(self.instance, "household", None)

        if board and household and board.household_id != household.id:
            raise serializers.ValidationError({"board": _("Board must belong to the same household.")})
        if rcd and household and rcd.household_id != household.id:
            raise serializers.ValidationError({"rcd": _("RCD must belong to the same household.")})
        return attrs


class ElectricCircuitSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = ElectricCircuit
        fields = [
            "id",
            "household",
            "board",
            "breaker",
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
        breaker = attrs.get("breaker") or getattr(self.instance, "breaker", None)
        household = attrs.get("household") or getattr(self.instance, "household", None)
        phase = attrs.get("phase", getattr(self.instance, "phase", None))

        if breaker and household and breaker.household_id != household.id:
            raise serializers.ValidationError({"breaker": _("Breaker must belong to the same household.")})
        if board and breaker and board.id != breaker.board_id:
            raise serializers.ValidationError({"breaker": _("Breaker must belong to the selected board.")})

        if board and board.supply_type == SupplyType.THREE_PHASE and not phase:
            raise serializers.ValidationError({"phase": _("Phase is required for three-phase board.")})

        if board and board.supply_type == SupplyType.SINGLE_PHASE and phase:
            raise serializers.ValidationError({"phase": _("Phase must be empty for single-phase board.")})

        return attrs


class UsagePointSerializer(HouseholdScopedModelSerializer):
    class Meta:
        model = UsagePoint
        fields = ["id", "household", "label", "name", "kind", "zone", "notes", "created_at", "updated_at"]
        read_only_fields = ["household", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        zone = attrs.get("zone") if "zone" in attrs else getattr(self.instance, "zone", None)
        household = attrs.get("household") or getattr(self.instance, "household", None)
        if zone and household and zone.household_id != household.id:
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
