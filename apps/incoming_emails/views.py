from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from core.permissions import IsHouseholdMember, resolve_request_household
from .models import IncomingEmail, IncomingEmailAttachment
from .serializers import IncomingEmailSerializer, IncomingEmailAttachmentSerializer


class IncomingEmailViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = IncomingEmailSerializer

    def get_queryset(self):
        queryset = IncomingEmail.objects.filter(
            household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        )
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


class IncomingEmailAttachmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = IncomingEmailAttachmentSerializer

    def get_queryset(self):
        queryset = IncomingEmailAttachment.objects.filter(
            incoming_email__household_id__in=self.request.user.householdmember_set.values_list("household_id", flat=True)
        )
        selected_household = resolve_request_household(self.request, required=False)
        if selected_household:
            queryset = queryset.filter(incoming_email__household=selected_household)
        return queryset
