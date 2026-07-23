from django.apps import AppConfig


class BudgetConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "budget"

    def ready(self):
        from datetime import time

        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable
        from pings.registry import PingSpec, register as register_ping

        from .models import Budget, RecurringExpense

        # RAG: let the agent find/cite a budget by name. There is no per-budget
        # detail page in V1 — every hit links to the single overview page.
        register(SearchableSpec(
            entity_type="budget",
            model=Budget,
            search_fields=("name",),
            label_attr="name",
            url_template="/app/budget?b={id}",
        ))

        register(SearchableSpec(
            entity_type="recurring_expense",
            model=RecurringExpense,
            search_fields=("label", "supplier"),
            label_attr="label",
            url_template="/app/budget/recurring?r={id}",
        ))

        # Write: the agent can create a budget on explicit request (undoable).
        register_writable(WritableSpec(
            entity_type="budget",
            create=_create_budget_from_agent,
            update=_update_budget_from_agent,
            updatable_fields=("name", "monthly_amount", "is_global"),
            resolve=_resolve_budget_for_agent,
            delete=_delete_budget_from_agent,
            label_attr="name",
            url_template="/app/budget?b={id}",
        ))

        register_writable(WritableSpec(
            entity_type="recurring_expense",
            create=_create_recurring_from_agent,
            resolve=_resolve_recurring_for_agent,
            delete=_delete_recurring_from_agent,
            label_attr="label",
            url_template="/app/budget/recurring?r={id}",
        ))

        # Proactive reminder: nudge when a recurrence is due (points to the app to
        # confirm in one click — the outbound ping is informational only).
        register_ping(PingSpec(
            ping_type="recurring_due",
            build_message=_build_recurring_due_message,
            default_send_at=time(8, 0),
        ))


def _create_budget_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``budget.services.create_budget``."""
    from .services import create_budget

    return create_budget(
        household,
        user,
        name=(fields.get("name") or "").strip(),
        monthly_amount=fields.get("monthly_amount"),
        is_global=bool(fields.get("is_global")),
    )


def _update_budget_from_agent(household, user, instance, fields):
    """Map the agent's raw ``fields`` to ``budget.services.update_budget``."""
    from .services import update_budget

    return update_budget(household, user, instance, fields=fields)


def _resolve_budget_for_agent(household, raw_id):
    """Household-scoped budget lookup for ``update_entity``."""
    from .models import Budget

    return Budget.objects.filter(household_id=household.id, pk=raw_id).first()


def _delete_budget_from_agent(household, user, object_id):
    """Undo a created budget — hard delete via ``budget.services.delete_budget``.

    Raises ``LookupError`` when the budget is already gone so a double undo is a
    no-op rather than an error.
    """
    from .services import delete_budget

    budget = _resolve_budget_for_agent(household, object_id)
    if budget is None:
        raise LookupError(f"no budget {object_id} in this household")
    delete_budget(household, user, budget)


def _create_recurring_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``budget.services.create_recurring_expense``."""
    from .services import create_recurring_expense

    return create_recurring_expense(
        household,
        user,
        label=(fields.get("label") or "").strip(),
        amount=fields.get("amount"),
        cadence=(fields.get("cadence") or "monthly"),
        next_due_date=fields.get("next_due_date"),
        supplier=fields.get("supplier") or "",
        notes=fields.get("notes") or "",
    )


def _resolve_recurring_for_agent(household, raw_id):
    from .models import RecurringExpense

    return RecurringExpense.objects.filter(household_id=household.id, pk=raw_id).first()


def _delete_recurring_from_agent(household, user, object_id):
    """Undo a created recurrence — hard delete via the service. LookupError = already gone."""
    from .services import delete_recurring_expense

    recurring = _resolve_recurring_for_agent(household, object_id)
    if recurring is None:
        raise LookupError(f"no recurring expense {object_id} in this household")
    delete_recurring_expense(household, user, recurring)


def _build_recurring_due_message(household, user, *, today):
    """Ping body: list recurrences due on/before ``today`` (None when nothing due)."""
    from django.utils.translation import gettext as _
    from django.utils.translation import ngettext

    from .models import RecurringExpense

    due = list(
        RecurringExpense.objects.filter(
            household_id=household.id, next_due_date__lte=today
        ).order_by("next_due_date")[:10]
    )
    if not due:
        return None

    header = ngettext(
        "%(count)d recurring expense is due:",
        "%(count)d recurring expenses are due:",
        len(due),
    ) % {"count": len(due)}
    lines = [f"• {rec.label} — {rec.amount} €" for rec in due]
    footer = _("Confirm them in the app when paid.")
    return "\n".join([header, *lines, "", footer])
