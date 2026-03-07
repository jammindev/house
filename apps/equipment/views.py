from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.utils.translation import gettext_lazy as _

from core.permissions import IsHouseholdMember, resolve_request_household
from interactions.models import Interaction
from .models import Equipment, EquipmentInteraction
from .serializers import EquipmentSerializer, EquipmentInteractionSerializer


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
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = resolve_request_household(self.request, required=True)
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

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
        selected_household = resolve_request_household(self.request, required=False)
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
