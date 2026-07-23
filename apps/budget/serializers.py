"""Budget serializers — CRUD API."""
from decimal import Decimal

from rest_framework import serializers

from .models import Budget, RecurringExpense


class BudgetSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the Budget API.

    ``monthly_amount`` must be strictly positive. ``is_global`` is writable but
    the "one global per household" invariant is enforced at the DB level (unique
    constraint) and surfaced as a clean 400 by the service layer.
    """

    monthly_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )

    class Meta:
        model = Budget
        fields = [
            "id",
            "household",
            "name",
            "monthly_amount",
            "is_global",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by"]

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field cannot be blank.")
        return value


class RecurringExpenseSerializer(serializers.ModelSerializer):
    """Read/write serializer for recurring expenses.

    ``amount`` must be strictly positive. ``budget_id`` (write) attaches an
    optional named budget; ``budget`` (read) echoes ``{id, name}``. Household
    scope + no-global-target validation live in the service layer.
    """

    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    budget = serializers.SerializerMethodField()
    budget_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = RecurringExpense
        fields = [
            "id",
            "household",
            "label",
            "amount",
            "cadence",
            "next_due_date",
            "supplier",
            "notes",
            "budget",
            "budget_id",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by"]

    def get_budget(self, obj):
        if not obj.budget_id:
            return None
        return {"id": str(obj.budget_id), "name": obj.budget.name}

    def validate_label(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field cannot be blank.")
        return value


class ConfirmOccurrenceSerializer(serializers.Serializer):
    """Input for POST /budget/recurring/{id}/confirm/.

    Validates the optional amount override the same way as the recurrence amount
    (strictly positive), so a bad value can never reach ``metadata.amount`` and
    poison the expense aggregations.
    """

    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=Decimal("0.01"),
    )
