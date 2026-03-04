from django.utils.translation import gettext_lazy as _
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from core.permissions import IsHouseholdMember, resolve_request_household

from .models import InsuranceContract
from .serializers import InsuranceContractSerializer


class InsuranceContractViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    serializer_class = InsuranceContractSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["type", "status", "payment_frequency"]
    search_fields = ["name", "provider", "contract_number", "insured_item", "coverage_summary", "notes"]
    ordering_fields = ["name", "renewal_date", "monthly_cost", "yearly_cost", "created_at", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = InsuranceContract.objects.for_user_households(self.request.user).select_related("created_by", "updated_by")
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
