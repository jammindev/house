from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from core.permissions import IsHouseholdMember, resolve_request_household
from interactions.models import Interaction
from .models import Equipment, EquipmentInteraction
from .serializers import EquipmentSerializer, EquipmentInteractionSerializer


class EquipmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = EquipmentSerializer

    def get_queryset(self):
        queryset = Equipment.objects.for_user_households(self.request.user)
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = resolve_request_household(self.request, required=True)
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class EquipmentInteractionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = EquipmentInteractionSerializer

    def get_queryset(self):
        queryset = EquipmentInteraction.objects.filter(
            equipment__household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        )
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(equipment__household=selected_household)
        return queryset

    def perform_create(self, serializer):
        equipment = serializer.validated_data["equipment"]
        interaction = serializer.validated_data["interaction"]
        if equipment.household_id != interaction.household_id:
            raise ValidationError({"interaction": "Interaction household must match equipment household."})
        if not Interaction.objects.for_user_households(self.request.user).filter(id=interaction.id).exists():
            raise ValidationError({"interaction": "Invalid interaction or access denied."})
        serializer.save(created_by=self.request.user)
