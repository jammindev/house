"""Budget REST API views."""
from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import IsHouseholdMember

from .aggregations import compute_budget_overview, compute_cashflow_projection
from .models import Budget, RecurringExpense
from .serializers import (
    BudgetSerializer,
    ConfirmOccurrenceSerializer,
    RecurringExpenseSerializer,
)
from .services import (
    confirm_recurring_occurrence,
    create_budget,
    create_recurring_expense,
    delete_budget,
    delete_recurring_expense,
    update_budget,
    update_recurring_expense,
)


def _household_today(household):
    """Household-local calendar date (recurrences are date-based, tz-aware)."""
    tz_name = getattr(household, "timezone", "") or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    return timezone.now().astimezone(tz).date()


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
                    "total_committed": "0.00",
                    "named_total_amount": "0.00",
                    "named_exceeds_global": False,
                }
            )
        return Response(compute_budget_overview(household=household))


class RecurringExpenseViewSet(viewsets.ModelViewSet):
    """CRUD for recurring expenses + due list, 1-click confirm, cash-flow projection.

    Every write delegates to ``budget.services`` (shared with the agent). Any
    household member may manage recurrences (parcours 21 decision).
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = RecurringExpenseSerializer

    def get_queryset(self):
        qs = RecurringExpense.objects.for_user_households(self.request.user).select_related(
            "created_by", "budget"
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs

    def _require_household(self):
        household = self.request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})
        return household

    def perform_create(self, serializer):
        household = self._require_household()
        data = serializer.validated_data
        serializer.instance = create_recurring_expense(
            household,
            self.request.user,
            label=data["label"],
            amount=data["amount"],
            cadence=data["cadence"],
            next_due_date=data["next_due_date"],
            supplier=data.get("supplier", ""),
            notes=data.get("notes", ""),
            budget_id=self.request.data.get("budget_id"),
        )

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        fields = dict(serializer.validated_data)
        # budget_id is write-only and not echoed in validated_data as a model field;
        # forward it explicitly when the client sent it (including null to detach).
        if "budget_id" in self.request.data:
            fields["budget_id"] = self.request.data.get("budget_id")
        serializer.instance = update_recurring_expense(
            household, self.request.user, serializer.instance, fields=fields
        )

    def perform_destroy(self, instance):
        household = self.request.household or instance.household
        delete_recurring_expense(household, self.request.user, instance)

    @action(detail=False, methods=["get"])
    def due(self, request):
        """GET /api/budget/recurring/due/ — recurrences due now (next_due_date <= today)."""
        household = request.household
        if household is None:
            return Response([])
        today = _household_today(household)
        qs = self.get_queryset().filter(next_due_date__lte=today)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def projection(self, request):
        """GET /api/budget/recurring/projection/ — upcoming outflows over 30/90 days."""
        household = request.household
        if household is None:
            return Response({"today": None, "horizons": []})
        return Response(compute_cashflow_projection(household=household))

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """POST /api/budget/recurring/{id}/confirm/ — confirm a due occurrence.

        Creates the real expense (optionally with an edited ``amount``) and advances
        the schedule. Returns the updated recurrence + the created interaction id so
        the client can offer an exact undo (delete expense + restore next_due_date).
        """
        recurring = self.get_object()
        household = request.household or recurring.household

        serializer = ConfirmOccurrenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interaction, recurring = confirm_recurring_occurrence(
            household,
            request.user,
            recurring,
            amount=serializer.validated_data.get("amount"),
        )
        return Response(
            {
                "recurring": self.get_serializer(recurring).data,
                "interaction_id": str(interaction.id),
            }
        )
