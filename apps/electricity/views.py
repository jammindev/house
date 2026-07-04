# electricity/views.py
"""Electricity API and template views (scaffold)."""

import json
from datetime import date

from django.db import transaction
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

from . import services
from .importers import registry as importers
from .models import (
    ChangeAction,
    ChangeEntityType,
    CircuitUsagePointLink,
    ConsumptionImport,
    ElectricCircuit,
    ElectricityBoard,
    ElectricityMeter,
    MaintenanceEvent,
    MeterReading,
    PlanChangeLog,
    ProtectiveDevice,
    UsagePoint,
)
from .permissions import IsElectricityOwnerWriteMemberRead
from .serializers import (
    CircuitUsagePointLinkSerializer,
    ConsumptionImportSerializer,
    ElectricCircuitSerializer,
    ElectricityBoardSerializer,
    ElectricityMeterSerializer,
    MaintenanceEventSerializer,
    MeterReadingSerializer,
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


# --- Consumption (parcours 10) ------------------------------------------------


class ElectricityMeterViewSet(HouseholdScopedModelViewSet):
    model = ElectricityMeter
    serializer_class = ElectricityMeterSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        is_active = self.request.query_params.get("is_active")
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=(is_active == "true"))
        return queryset


class MeterReadingViewSet(HouseholdScopedModelViewSet):
    """Readings CRUD — every write regenerates the derived daily estimates.

    Validation lives in ``MeterReadingSerializer`` and the regeneration in
    ``services.rebuild_reading_records`` — the same two pieces the agent's
    write path (``services.create_meter_reading``) goes through.
    """

    model = MeterReading
    serializer_class = MeterReadingSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        meter_id = self.request.query_params.get("meter")
        if meter_id:
            queryset = queryset.filter(meter_id=meter_id)
        return queryset.order_by("-reading_at")

    def perform_create(self, serializer):
        with transaction.atomic():
            super().perform_create(serializer)
            services.rebuild_reading_records(serializer.instance.meter, serializer.instance.register)

    def perform_update(self, serializer):
        old_pair = (serializer.instance.meter, serializer.instance.register)
        with transaction.atomic():
            super().perform_update(serializer)
            reading = serializer.instance
            services.rebuild_reading_records(reading.meter, reading.register)
            if old_pair != (reading.meter, reading.register):
                services.rebuild_reading_records(*old_pair)

    def perform_destroy(self, instance):
        services.delete_meter_reading(instance)


class ConsumptionSummaryView(APIView):
    """Server-side aggregation of consumption records by granularity."""

    permission_classes = [IsAuthenticated, IsElectricityOwnerWriteMemberRead]

    def get(self, request):
        household = request.household
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})

        meter_id = request.query_params.get("meter")
        if not meter_id:
            raise ValidationError({"meter": [_("This parameter is required.")]})
        meter = ElectricityMeter.objects.for_household(household.id).filter(id=meter_id).first()
        if meter is None:
            return Response({"detail": _("Meter not found.")}, status=status.HTTP_404_NOT_FOUND)

        granularity = request.query_params.get("granularity", "day")
        if granularity not in services.GRANULARITIES:
            raise ValidationError({"granularity": [_("Must be one of: hour, day, month, year.")]})

        try:
            date_from = date.fromisoformat(request.query_params.get("date_from", ""))
            date_to = date.fromisoformat(request.query_params.get("date_to", ""))
        except ValueError:
            raise ValidationError({"date_from": [_("date_from and date_to must be ISO dates (YYYY-MM-DD).")]})
        if date_to < date_from:
            raise ValidationError({"date_to": [_("date_to must be on or after date_from.")]})

        return Response(
            services.consumption_summary(
                household, meter, granularity=granularity, date_from=date_from, date_to=date_to
            )
        )


class ConsumptionImportViewSet(HouseholdScopedModelViewSet):
    """Consumption file imports — list history, upload, preview.

    ``POST`` always answers 201 with the import trace: a business failure
    (unreadable file) is ``status='failed'`` on the object, not an API error —
    and zero records are written in that case.
    """

    model = ConsumptionImport
    serializer_class = ConsumptionImportSerializer
    http_method_names = ["get", "post", "head", "options"]

    def create(self, request, *args, **kwargs):
        household = request.household
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})

        uploaded = request.FILES.get("file")
        if uploaded is None:
            raise ValidationError({"file": [_("A file is required.")]})

        meter_id = request.data.get("meter")
        if not meter_id:
            raise ValidationError({"meter": [_("This field is required.")]})
        meter = ElectricityMeter.objects.for_household(household.id).filter(id=meter_id).first()
        if meter is None:
            raise ValidationError({"meter": [_("Meter not found.")]})

        provider = request.data.get("provider") or None
        if provider and importers.get_importer(provider) is None:
            raise ValidationError({"provider": [_("Unknown provider.")]})

        options = request.data.get("options") or None
        if isinstance(options, str):
            try:
                options = json.loads(options)
            except json.JSONDecodeError:
                raise ValidationError({"options": [_("Must be valid JSON.")]})

        imported = services.import_consumption_file(
            household,
            request.user,
            meter=meter,
            uploaded_file=uploaded,
            provider=provider,
            options=options,
        )
        return Response(self.get_serializer(imported).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="preview")
    def preview(self, request):
        uploaded = request.FILES.get("file")
        if uploaded is None:
            raise ValidationError({"file": [_("A file is required.")]})
        return Response(services.preview_consumption_file(uploaded.read()))
