from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsHouseholdMember
from interactions.models import Interaction
from interactions.services import create_expense_interaction
from .models import Equipment, EquipmentInteraction
from .serializers import (
    EquipmentInteractionSerializer,
    EquipmentPurchaseSerializer,
    EquipmentSerializer,
)


class EquipmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = EquipmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "zone", "category"]
    search_fields = ["name", "manufacturer", "model", "serial_number", "notes"]
    ordering_fields = ["name", "created_at", "updated_at", "last_service_at", "warranty_expires_on"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = Equipment.objects.for_user_households(self.request.user).select_related("zone", "created_by", "updated_by")
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="register-purchase")
    def register_purchase(self, request, pk=None):
        """Snapshot purchase fields on the equipment + create an expense Interaction.

        Single-action endpoint: writes amount/supplier/date on the equipment AND
        creates an Interaction(type=expense) linked via the polymorphic source FK.
        """
        equipment = self.get_object()
        serializer = EquipmentPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data.get("amount")
        supplier = serializer.validated_data.get("supplier", "") or ""
        occurred_at = serializer.validated_data.get("occurred_at") or timezone.now()
        notes = serializer.validated_data.get("notes", "") or ""

        with transaction.atomic():
            # Equipment-specific snapshot of the most recent purchase
            if amount is not None:
                equipment.purchase_price = amount
            if supplier:
                equipment.purchase_vendor = supplier
            equipment.purchase_date = occurred_at.date()
            equipment.updated_by = request.user
            equipment.save(update_fields=[
                "purchase_price", "purchase_vendor", "purchase_date",
                "updated_by", "updated_at",
            ])

            interaction = create_expense_interaction(
                source=equipment,
                user=request.user,
                amount=amount,
                supplier=supplier,
                occurred_at=occurred_at,
                notes=notes,
                kind="equipment_purchase",
                extra_metadata={"equipment_name": equipment.name},
            )

        payload = EquipmentSerializer(equipment, context={"request": request}).data
        payload["interaction_id"] = str(interaction.id)
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def audit(self, request, pk=None):
        equipment = self.get_object()

        def serialize_user(user):
            if not user:
                return None
            return {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
            }

        return Response(
            {
                "created_by": serialize_user(equipment.created_by),
                "updated_by": serialize_user(equipment.updated_by),
            }
        )


class EquipmentInteractionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = EquipmentInteractionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["equipment", "interaction", "role"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = EquipmentInteraction.objects.select_related("equipment", "interaction", "created_by").filter(
            equipment__household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        )
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(equipment__household=selected_household)
        return queryset

    def perform_create(self, serializer):
        equipment = serializer.validated_data["equipment"]
        interaction = serializer.validated_data["interaction"]
        if not Equipment.objects.for_user_households(self.request.user).filter(id=equipment.id).exists():
            raise ValidationError({"equipment": _("Invalid equipment or access denied.")})
        if equipment.household_id != interaction.household_id:
            raise ValidationError({"interaction": _("Interaction household must match equipment household.")})
        if not Interaction.objects.for_user_households(self.request.user).filter(id=interaction.id).exists():
            raise ValidationError({"interaction": _("Invalid interaction or access denied.")})
        serializer.save(created_by=self.request.user)
