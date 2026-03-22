# electricity/views.py
"""Electricity API and template views (scaffold)."""

from django.db.models import ProtectedError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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


class MappingLookupView(APIView):
    permission_classes = [IsAuthenticated, IsElectricityOwnerWriteMemberRead]

    def get(self, request):
        selected_household = resolve_electricity_household(request)
        if not selected_household:
            raise ValidationError({"household_id": "A valid household context is required."})

        ref = (request.query_params.get("ref") or "").strip()
        if not ref:
            raise ValidationError({"ref": "Lookup reference is required."})

        protective_device = ProtectiveDevice.objects.for_household(selected_household.id).filter(label=ref).first()
        if protective_device:
            circuits = list(ElectricCircuit.objects.for_household(selected_household.id).filter(protective_device=protective_device))
            usage_points = list(
                UsagePoint.objects.for_household(selected_household.id).filter(
                    circuit_links__circuit__in=circuits,
                    circuit_links__is_active=True,
                ).distinct()
            )
            return Response(
                {
                    "kind": "protective_device",
                    "label": protective_device.label,
                    "protective_device": {"id": str(protective_device.id), "label": protective_device.label},
                    "circuits": [{"id": str(c.id), "label": c.label, "name": c.name} for c in circuits],
                    "usage_points": [{"id": str(u.id), "label": u.label, "name": u.name} for u in usage_points],
                }
            )

        usage_point = UsagePoint.objects.for_household(selected_household.id).filter(label=ref).first()
        if usage_point:
            link = (
                CircuitUsagePointLink.objects.for_household(selected_household.id)
                .select_related("circuit__protective_device")
                .filter(usage_point=usage_point, is_active=True)
                .first()
            )
            circuit = link.circuit if link else None
            protective_device_for_point = circuit.protective_device if circuit else None
            return Response(
                {
                    "kind": "usage_point",
                    "label": usage_point.label,
                    "usage_point": {"id": str(usage_point.id), "label": usage_point.label, "name": usage_point.name},
                    "circuit": (
                        {"id": str(circuit.id), "label": circuit.label, "name": circuit.name}
                        if circuit
                        else None
                    ),
                    "protective_device": (
                        {"id": str(protective_device_for_point.id), "label": protective_device_for_point.label}
                        if protective_device_for_point
                        else None
                    ),
                }
            )

        circuit = ElectricCircuit.objects.for_household(selected_household.id).select_related("protective_device").filter(label=ref).first()
        if circuit:
            usage_points = list(
                UsagePoint.objects.for_household(selected_household.id).filter(
                    circuit_links__circuit=circuit,
                    circuit_links__is_active=True,
                ).distinct()
            )
            return Response(
                {
                    "kind": "circuit",
                    "label": circuit.label,
                    "circuit": {"id": str(circuit.id), "label": circuit.label, "name": circuit.name},
                    "protective_device": {"id": str(circuit.protective_device.id), "label": circuit.protective_device.label},
                    "usage_points": [{"id": str(u.id), "label": u.label, "name": u.name} for u in usage_points],
                }
            )

        return Response({"detail": _("Not found.")}, status=status.HTTP_404_NOT_FOUND)
