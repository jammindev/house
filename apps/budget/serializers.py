"""Budget serializers — CRUD API."""
from decimal import Decimal

from rest_framework import serializers

from .models import Budget


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
