from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from core.permissions import IsHouseholdMember
from .models import Contact, Address, Email, Phone, Structure
from .serializers import (
    ContactSerializer, ContactNestedSerializer,
    AddressSerializer, EmailSerializer, PhoneSerializer,
    StructureSerializer, StructureNestedSerializer,
)


class HouseholdScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get_queryset(self):
        queryset = self.model.objects.for_user_households(self.request.user)
        selected_household = self.request.household
        if selected_household:
            queryset = queryset.filter(household=selected_household)
        return queryset

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})

        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


def _validate_related_household(serializer, household, field_name):
    related_obj = serializer.validated_data.get(field_name)
    if related_obj and getattr(related_obj, "household_id", None) != household.id:
        raise ValidationError({field_name: f"{field_name.capitalize()} household must match selected household."})


class StructureViewSet(HouseholdScopedViewSet):
    model = Structure
    serializer_class = StructureSerializer

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return StructureNestedSerializer
        return StructureSerializer


class ContactViewSet(HouseholdScopedViewSet):
    model = Contact
    serializer_class = ContactSerializer

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return ContactNestedSerializer
        return ContactSerializer

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})
        _validate_related_household(serializer, household, "structure")
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        _validate_related_household(serializer, household, "structure")
        serializer.save(updated_by=self.request.user)


class AddressViewSet(HouseholdScopedViewSet):
    model = Address
    serializer_class = AddressSerializer

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})
        _validate_related_household(serializer, household, "contact")
        _validate_related_household(serializer, household, "structure")
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        _validate_related_household(serializer, household, "contact")
        _validate_related_household(serializer, household, "structure")
        serializer.save(updated_by=self.request.user)


class EmailViewSet(HouseholdScopedViewSet):
    model = Email
    serializer_class = EmailSerializer

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})
        _validate_related_household(serializer, household, "contact")
        _validate_related_household(serializer, household, "structure")
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        _validate_related_household(serializer, household, "contact")
        _validate_related_household(serializer, household, "structure")
        serializer.save(updated_by=self.request.user)


class PhoneViewSet(HouseholdScopedViewSet):
    model = Phone
    serializer_class = PhoneSerializer

    def perform_create(self, serializer):
        household = self.request.household
        if not household:
            raise ValidationError({"household_id": "A valid household context is required."})
        _validate_related_household(serializer, household, "contact")
        _validate_related_household(serializer, household, "structure")
        serializer.save(household=household, created_by=self.request.user)

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        _validate_related_household(serializer, household, "contact")
        _validate_related_household(serializer, household, "structure")
        serializer.save(updated_by=self.request.user)
