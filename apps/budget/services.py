"""
Budget write service — single source of truth for create/update/delete.

Both the REST viewset and the agent's ``create_entity`` tool go through these
functions so validation (through ``BudgetSerializer``) and the household-scope
invariants live in one place. Never write budgets via the raw ORM from a
caller — always here.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from .models import Budget
from .serializers import BudgetSerializer


def _save_scoped(serializer, household, user, *, creating: bool) -> Budget:
    """Persist through the serializer, mapping DB uniqueness clashes to 400s.

    The two unique constraints (one global per household, unique name per
    household) can only be checked at write time — a race or a duplicate name
    surfaces as ``IntegrityError`` which we translate into the same field errors
    a client expects from validation.
    """
    try:
        with transaction.atomic():
            if creating:
                return serializer.save(household=household, created_by=user)
            return serializer.save(updated_by=user)
    except IntegrityError as exc:
        message = str(exc).lower()
        if "one_global_budget_per_household" in message:
            raise ValidationError(
                {"is_global": "This household already has a global budget."}
            )
        if "unique_budget_name_per_household" in message:
            raise ValidationError({"name": "A budget with this name already exists."})
        raise ValidationError({"detail": "Could not save the budget."})


def create_budget(
    household,
    user,
    *,
    name: str,
    monthly_amount: Decimal | str | float,
    is_global: bool = False,
) -> Budget:
    """Create a budget for ``household`` on behalf of ``user``.

    Reuses ``BudgetSerializer`` for validation (positive amount, non-blank name).
    Raises ``rest_framework.ValidationError`` on invalid input or a uniqueness
    clash (duplicate name, second global budget).
    """
    serializer = BudgetSerializer(
        data={
            "name": name,
            "monthly_amount": monthly_amount,
            "is_global": bool(is_global),
        }
    )
    serializer.is_valid(raise_exception=True)
    return _save_scoped(serializer, household, user, creating=True)


def update_budget(household, user, budget: Budget, *, fields: dict) -> Budget:
    """Update ``budget`` — shared by the REST update and the agent's update.

    Only ``name``, ``monthly_amount`` and ``is_global`` are editable. Validation
    and uniqueness handling mirror ``create_budget``.
    """
    allowed = {"name", "monthly_amount", "is_global"}
    payload = {k: v for k, v in fields.items() if k in allowed}

    serializer = BudgetSerializer(budget, data=payload, partial=True)
    serializer.is_valid(raise_exception=True)
    return _save_scoped(serializer, household, user, creating=False)


def delete_budget(household, user, budget: Budget) -> None:
    """Delete a budget — the undo of ``create_budget``.

    A hard delete. Thanks to ``Interaction.budget`` being ``on_delete=SET_NULL``,
    expenses attached to this budget are NOT deleted: they simply fall back to
    the "hors budget" bucket (AC of Lot 1). Scoped to the household defensively.
    """
    if budget.household_id != household.id:
        raise ValueError("delete_budget: budget belongs to another household")
    budget.delete()
