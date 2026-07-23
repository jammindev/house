"""Budget REST API views."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import IsHouseholdMember

from .aggregations import compute_budget_overview
from .models import Budget
from .serializers import BudgetSerializer
from .services import create_budget, delete_budget, update_budget


class BudgetViewSet(viewsets.ModelViewSet):
    """CRUD for household budgets + the monthly overview.

    Every write delegates to ``budget.services`` so the REST path and the agent
    path stay identical. Any household member may manage budgets (Lot 1 decision).
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = BudgetSerializer

    def get_queryset(self):
        qs = Budget.objects.for_user_households(self.request.user).select_related("created_by")
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs

    def _require_household(self):
        household = self.request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})
        return household

    def perform_create(self, serializer):
        # The service owns the write (shared with the agent); bind the created
        # instance back so DRF's 201 response serializes it.
        household = self._require_household()
        serializer.instance = create_budget(
            household,
            self.request.user,
            name=serializer.validated_data["name"],
            monthly_amount=serializer.validated_data["monthly_amount"],
            is_global=serializer.validated_data.get("is_global", False),
        )

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        serializer.instance = update_budget(
            household,
            self.request.user,
            serializer.instance,
            fields=dict(serializer.validated_data),
        )

    def perform_destroy(self, instance):
        household = self.request.household or instance.household
        delete_budget(household, self.request.user, instance)

    @action(detail=False, methods=["get"])
    def overview(self, request):
        """GET /api/budget/budgets/overview/

        The month's budgets with spent/ceiling, the "hors budget" total and the
        optional global cap. Empty-but-valid shape when no household context.
        """
        household = request.household
        if household is None:
            return Response(
                {
                    "month": None,
                    "global": None,
                    "budgets": [],
                    "unbudgeted": "0.00",
                    "total_spent": "0.00",
                    "named_total_amount": "0.00",
                    "named_exceeds_global": False,
                }
            )
        return Response(compute_budget_overview(household=household))
