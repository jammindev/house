"""
Budget write service — single source of truth for create/update/delete.

Both the REST viewset and the agent's ``create_entity`` tool go through these
functions so validation (through ``BudgetSerializer``) and the household-scope
invariants live in one place. Never write budgets via the raw ORM from a
caller — always here.
"""
from __future__ import annotations

from decimal import Decimal

import calendar
from datetime import date

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Budget, RecurringExpense
from .serializers import BudgetSerializer, RecurringExpenseSerializer


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


# --- Recurring expenses (parcours 21 lot 2) ---------------------------------


_CADENCE_MONTHS = {
    RecurringExpense.Cadence.MONTHLY: 1,
    RecurringExpense.Cadence.QUARTERLY: 3,
    RecurringExpense.Cadence.YEARLY: 12,
}


def _add_months(d: date, months: int) -> date:
    """Add ``months`` to ``d``, clamping the day to the target month's length."""
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return d.replace(year=year, month=month, day=day)


def advance_due_date(d: date, cadence: str) -> date:
    """Return the next occurrence date after ``d`` for ``cadence``."""
    months = _CADENCE_MONTHS.get(cadence)
    if months is None:
        raise ValueError(f"unknown cadence: {cadence!r}")
    return _add_months(d, months)


def _resolve_recurring_budget(household_id, budget_id):
    """Resolve an optional budget for a recurrence (named budgets only).

    Reuses the interactions resolver so 'scoped to household' + 'not the global
    budget' stay defined in one place. Maps its ValueError to a DRF 400.
    """
    from interactions.services import _resolve_expense_budget

    try:
        return _resolve_expense_budget(household_id, budget_id)
    except ValueError as exc:
        raise ValidationError({"budget_id": str(exc)})


def create_recurring_expense(
    household,
    user,
    *,
    label: str,
    amount,
    cadence: str,
    next_due_date,
    supplier: str = "",
    notes: str = "",
    budget_id=None,
) -> RecurringExpense:
    """Create a recurring expense — shared by the REST viewset and the agent.

    Validates scalars through ``RecurringExpenseSerializer`` and resolves the
    optional budget separately (household-scoped, never the global budget).
    """
    serializer = RecurringExpenseSerializer(
        data={
            "label": label,
            "amount": amount,
            "cadence": cadence,
            "next_due_date": next_due_date,
            "supplier": supplier or "",
            "notes": notes or "",
        }
    )
    serializer.is_valid(raise_exception=True)
    budget = _resolve_recurring_budget(household.id, budget_id)
    with transaction.atomic():
        return serializer.save(household=household, created_by=user, budget=budget)


def update_recurring_expense(household, user, recurring: RecurringExpense, *, fields: dict) -> RecurringExpense:
    """Update a recurring expense. ``budget_id`` (when present) re-resolves the FK."""
    if recurring.household_id != household.id:
        raise ValueError("update_recurring_expense: belongs to another household")
    allowed = {"label", "amount", "cadence", "next_due_date", "supplier", "notes"}
    payload = {k: v for k, v in fields.items() if k in allowed}

    serializer = RecurringExpenseSerializer(recurring, data=payload, partial=True)
    serializer.is_valid(raise_exception=True)

    extra = {"updated_by": user}
    if "budget_id" in fields:
        extra["budget"] = _resolve_recurring_budget(household.id, fields.get("budget_id"))
    with transaction.atomic():
        return serializer.save(**extra)


def delete_recurring_expense(household, user, recurring: RecurringExpense) -> None:
    """Hard delete a recurring expense (the undo of ``create_recurring_expense``).

    Already-confirmed occurrences are real ``Interaction`` rows and are left
    untouched — only the schedule is removed.
    """
    if recurring.household_id != household.id:
        raise ValueError("delete_recurring_expense: belongs to another household")
    recurring.delete()


def confirm_recurring_occurrence(
    household,
    user,
    recurring: RecurringExpense,
    *,
    amount=None,
    occurred_at=None,
):
    """Confirm one due occurrence: create the expense and advance the schedule.

    Records a real ``Interaction(type='expense')`` via the interactions service
    (feeds the journal + budget counters), tagged ``metadata.kind='recurring'``
    with a ``recurring_id`` back-reference, then advances ``next_due_date`` by the
    cadence. ``amount`` overrides the recurrence amount for this occurrence only
    (a bill varies). Never auto-called — always an explicit user action.

    Returns ``(interaction, recurring)``.
    """
    if recurring.household_id != household.id:
        raise ValueError("confirm_recurring_occurrence: belongs to another household")

    from interactions.services import create_manual_expense_interaction

    occurrence_amount = amount if amount is not None else recurring.amount
    with transaction.atomic():
        interaction = create_manual_expense_interaction(
            household=household,
            user=user,
            subject=recurring.label,
            amount=occurrence_amount,
            supplier=recurring.supplier,
            occurred_at=occurred_at or timezone.now(),
            notes=recurring.notes,
            budget_id=str(recurring.budget_id) if recurring.budget_id else None,
            kind="recurring",
            extra_metadata={"recurring_id": str(recurring.id)},
        )
        recurring.next_due_date = advance_due_date(recurring.next_due_date, recurring.cadence)
        recurring.updated_by = user
        recurring.save(update_fields=["next_due_date", "updated_by", "updated_at"])

    return interaction, recurring
