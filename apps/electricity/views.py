# electricity/views.py
"""Electricity API and template views (scaffold)."""

from django.db import transaction
from django.db.models import ProtectedError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from households.models import HouseholdMember

from .models import (
    ChangeAction,
    ChangeEntityType,
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    MaintenanceEvent,
    PlanChangeLog,
    ProtectiveDevice,
    UsagePoint,
)
from .permissions import IsElectricityOwnerWriteMemberRead
from .serializers import (
    CircuitUsagePointLinkSerializer,
    ElectricCircuitSerializer,
    ElectricityBoardSerializer,
    MaintenanceEventSerializer,
    PlanChangeLogSerializer,
    ProtectiveDeviceSerializer,
    UsagePointSerializer,
)


def resolve_electricity_household(request):
    """Resolve selected household — now delegated to the middleware-set request.household."""
    return request.household


def is_household_owner(user, household):
    if not household:
        return False
    return HouseholdMember.objects.filter(
        household_id=household.id,
        user_id=user.id,
        role=HouseholdMember.Role.OWNER,
    ).exists()


class HouseholdScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsElectricityOwnerWriteMemberRead]

    def get_queryset(self):
        queryset = self.model.objects.for_user_households(self.request.user)
        selected_household = resolve_electricity_household(self.request)
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})
        serializer.save(household=household, created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if isinstance(instance, ProtectiveDevice):
            has_active_circuits = ElectricCircuit.objects.for_household(instance.household_id).filter(
                protective_device=instance,
                is_active=True,
            ).exists()
            if has_active_circuits:
                return Response(
                    {"detail": _("Cannot delete protective device with active circuits.")},
                    status=status.HTTP_409_CONFLICT,
                )

        if isinstance(instance, ElectricCircuit):
            has_active_links = CircuitUsagePointLink.objects.for_household(instance.household_id).filter(
                circuit=instance,
                is_active=True,
            ).exists()
            if has_active_links:
                return Response(
                    {"detail": _("Cannot delete circuit with active usage point links.")},
                    status=status.HTTP_409_CONFLICT,
                )

        if isinstance(instance, UsagePoint):
            has_active_links = CircuitUsagePointLink.objects.for_household(instance.household_id).filter(
                usage_point=instance,
                is_active=True,
            ).exists()
            if has_active_links:
                return Response(
                    {"detail": _("Cannot delete usage point with active circuit link.")},
                    status=status.HTTP_409_CONFLICT,
                )

        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": _("Cannot delete resource with active dependencies.")},
                status=status.HTTP_409_CONFLICT,
            )


class ElectricityBoardViewSet(HouseholdScopedModelViewSet):
    model = ElectricityBoard
    serializer_class = ElectricityBoardSerializer


class ProtectiveDeviceViewSet(HouseholdScopedModelViewSet):
    model = ProtectiveDevice
    serializer_class = ProtectiveDeviceSerializer


class ElectricCircuitViewSet(HouseholdScopedModelViewSet):
    model = ElectricCircuit
    serializer_class = ElectricCircuitSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        protective_device_id = self.request.query_params.get("protective_device")
        phase = self.request.query_params.get("phase")
        is_active = self.request.query_params.get("is_active")

        if protective_device_id:
            queryset = queryset.filter(protective_device_id=protective_device_id)
        if phase:
            queryset = queryset.filter(phase=phase)
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=(is_active == "true"))
        return queryset


class UsagePointViewSet(HouseholdScopedModelViewSet):
    model = UsagePoint
    serializer_class = UsagePointSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        kind = self.request.query_params.get("kind")
        if kind:
            queryset = queryset.filter(kind=kind)
        return queryset

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request, *args, **kwargs):
        household = request.household
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})

        try:
            quantity = int(request.data.get("quantity", 1))
        except (TypeError, ValueError):
            return Response({"quantity": [_("Must be an integer.")]}, status=status.HTTP_400_BAD_REQUEST)
        if quantity < 1 or quantity > 50:
            return Response({"quantity": [_("Must be between 1 and 50.")]}, status=status.HTTP_400_BAD_REQUEST)

        base_data = {k: v for k, v in request.data.items() if k != "quantity"}
        base_label = (base_data.get("label") or "").strip()

        if quantity > 1 and not base_label:
            return Response({"label": [_("A label prefix is required when creating multiple usage points.")]}, status=status.HTTP_400_BAD_REQUEST)

        payloads = []
        for i in range(1, quantity + 1):
            payload = dict(base_data)
            if quantity > 1:
                payload["label"] = f"{base_label}-{i:02d}"
            payloads.append(payload)

        serializers_list = []
        for payload in payloads:
            ser = self.get_serializer(data=payload)
            if not ser.is_valid():
                return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
            serializers_list.append(ser)

        with transaction.atomic():
            instances = [
                ser.save(household=household, created_by=request.user, updated_by=request.user)
                for ser in serializers_list
            ]

        return Response(
            self.get_serializer(instances, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class CircuitUsagePointLinkViewSet(HouseholdScopedModelViewSet):
    model = CircuitUsagePointLink
    serializer_class = CircuitUsagePointLinkSerializer

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        link = self.get_object()
        if not link.is_active:
            return Response(self.get_serializer(link).data, status=status.HTTP_200_OK)

        link.is_active = False
        link.deactivated_at = timezone.now()
        link.deactivated_by = request.user
        link.updated_by = request.user
        link.save(update_fields=["is_active", "deactivated_at", "deactivated_by", "updated_by", "updated_at"])

        PlanChangeLog.objects.create(
            household=link.household,
            actor=request.user,
            created_by=request.user,
            updated_by=request.user,
            action=ChangeAction.DEACTIVATE,
            entity_type=ChangeEntityType.LINK,
            entity_id=link.id,
            payload={
                "circuit_id": str(link.circuit_id),
                "usage_point_id": str(link.usage_point_id),
            },
        )
        return Response(self.get_serializer(link).data, status=status.HTTP_200_OK)


class MaintenanceEventViewSet(HouseholdScopedModelViewSet):
    model = MaintenanceEvent
    serializer_class = MaintenanceEventSerializer


class PlanChangeLogViewSet(HouseholdScopedModelViewSet):
    model = PlanChangeLog
    serializer_class = PlanChangeLogSerializer
    http_method_names = ["get", "head", "options"]


