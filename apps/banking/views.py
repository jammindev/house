"""Banking REST API views."""
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from core.permissions import IsHouseholdMember

from .models import BankAccount
from .serializers import BankAccountSerializer
from .services import archive_account, create_account, update_account


class BankAccountViewSet(viewsets.ModelViewSet):
    """CRUD for the household's accounts.

    Every write delegates to ``banking.services`` so the REST path, the statement
    importer (lot 2) and any future agent path stay identical. Any household
    member may manage accounts — money is a household-wide matter, like budgets.

    ``DELETE`` archives instead of destroying: an account owns the imported
    history from lot 2 on, so closing it must stay reversible.
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = BankAccountSerializer

    def get_queryset(self):
        qs = BankAccount.objects.for_user_households(self.request.user).select_related(
            "created_by"
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        if self.request.query_params.get("archived") != "true":
            qs = qs.filter(archived=False)
        return qs

    def _require_household(self):
        household = self.request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})
        return household

    def perform_create(self, serializer):
        # The service owns the write; bind the instance back so DRF's 201
        # response serializes what was actually persisted.
        household = self._require_household()
        serializer.instance = create_account(
            household=household,
            user=self.request.user,
            **serializer.validated_data,
        )

    def perform_update(self, serializer):
        serializer.instance = update_account(
            account=serializer.instance,
            user=self.request.user,
            fields=dict(serializer.validated_data),
        )

    def perform_destroy(self, instance):
        archive_account(account=instance, user=self.request.user)
