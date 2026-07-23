from django.apps import AppConfig


class BudgetConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "budget"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable

        from .models import Budget

        # RAG: let the agent find/cite a budget by name. There is no per-budget
        # detail page in V1 — every hit links to the single overview page.
        register(SearchableSpec(
            entity_type="budget",
            model=Budget,
            search_fields=("name",),
            label_attr="name",
            url_template="/app/budget?b={id}",
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
