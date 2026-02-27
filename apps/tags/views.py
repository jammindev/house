from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from core.permissions import IsHouseholdMember, resolve_request_household
from households.models import HouseholdMember
from interactions.models import Interaction
from .models import Tag, InteractionTag
from .serializers import TagSerializer, InteractionTagSerializer


class TagViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = TagSerializer

    def get_queryset(self):
        queryset = Tag.objects.for_user_households(self.request.user)
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


class InteractionTagViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = InteractionTagSerializer

    def get_queryset(self):
        queryset = InteractionTag.objects.filter(
            interaction__household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        ).select_related("interaction", "tag")
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(interaction__household=selected_household)
        return queryset

    def perform_create(self, serializer):
        interaction = serializer.validated_data.get("interaction")
        tag = serializer.validated_data.get("tag")

        if interaction.household_id != tag.household_id:
            raise ValidationError({"tag": "Tag household must match interaction household."})

        if not HouseholdMember.objects.filter(
            household_id=interaction.household_id,
            user_id=self.request.user.id,
        ).exists():
            raise ValidationError({"interaction": "Invalid interaction or access denied."})

        serializer.save(created_by=self.request.user)
