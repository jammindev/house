---
name: budget-module-conventions
description: Budget app (parcours 21) — factories, URL names, auth pattern, agent parity contract, SET_NULL on expense delete
metadata:
  type: project
---

## URL names (basename="budget")

- `budget-list` → GET/POST `/api/budget/budgets/`
- `budget-detail` → GET/PATCH/DELETE `/api/budget/budgets/{id}/`
- `budget-overview` → GET `/api/budget/budgets/overview/`

## Factory

`BudgetFactory` in `apps/budget/tests/factories.py`. Requires `household` and `created_by` supplied per-test (not set in factory). Has `UserFactory`, `HouseholdFactory`, `HouseholdMemberFactory` mirrors of the chickens pattern.

## Auth + household context

Standard `IsHouseholdMember`: `force_authenticate(user=user)` + set `user.active_household = hh` + `user.save(update_fields=["active_household"])`. Any member (including non-owner) may create/update/delete budgets — this is a Lot 1 decision.

## Constraints

- `one_global_budget_per_household`: at most one `is_global=True` Budget per household → second attempt raises ValidationError with `{"is_global": ...}`.
- `unique_budget_name_per_household`: unique (household, name) → duplicate raises ValidationError with `{"name": ...}`.
- IntegrityErrors from these constraints are caught and mapped to 400 ValidationErrors in `budget.services._save_scoped`.

## Interactions FK (parcours 21)

`Interaction.budget` FK is nullable, `on_delete=SET_NULL`. Deleting a budget leaves its expenses intact with `budget_id=None` (they become "hors budget").

`_resolve_expense_budget` in `interactions/services.py`:
- Returns None when budget_id is falsy.
- Raises `ValueError("budget not found in this household")` when budget not in household.
- Raises `ValueError("cannot attach an expense to the global budget")` when budget.is_global.

The `budget_id` field is on `ManualExpenseSerializer` as optional UUIDField. Errors from `ValueError` in the view are caught and raised as `ValidationError({"detail": ...})`.

## Agent parity contract

`apps/budget/apps.py` registers a `WritableSpec(entity_type="budget")`. The `create` callable (`_create_budget_from_agent`) delegates directly to `budget.services.create_budget` — same validation path as REST. The `delete` callable raises `LookupError` (not `ValueError`) when the budget is not found, for idempotent undo.

`find_spec("budget")` is available once Django apps are ready (no registry reset needed in tests — the app is already loaded).

## Helper pattern in tests

```python
def _make_owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user
```

Import `HouseholdMember` from `households.models` explicitly — do NOT use `household.members.model.Role` (the `members` reverse manager may not be available at that point).

## Test files created (parcours 21, Lot 1)

- `apps/budget/tests/factories.py`
- `apps/budget/tests/test_models_budget.py`
- `apps/budget/tests/test_api_budget.py`
- `apps/budget/tests/test_interactions_budget_integration.py`
- `apps/budget/tests/test_agent_budget.py`

## BudgetReport (parcours 21, Lot 3) — URL names, viewset, patterns

Router basename: `"budget-report"`.
- `budget-report-list` → GET `/api/budget/reports/`
- `budget-report-detail` → GET `/api/budget/reports/{month}/`  (`lookup_field='month'`, regex `\d{4}-\d{2}`)
- `budget-report-latest` → GET `/api/budget/reports/latest/`

`BudgetReportViewSet` is `ReadOnlyModelViewSet` → POST/PUT/PATCH/DELETE all return 405.

`get_serializer_context` injects `polish=True` for `latest` and `retrieve` actions; `polish=False` for list. In tests always call `render_report(report, polish=False)` to skip the AI path.

`BudgetReport.stats` is a JSONField that may contain `_polished` cache; the serializer's `get_stats()` strips it from the API response.

## Stats + service patterns

`compute_month_stats(household, "YYYY-MM")` — amounts returned as `str(Decimal)` (e.g. `"100.00"`). Recurring filter uses `metadata__kind="recurring"` on Interaction; to test it, create a manual expense then overwrite `metadata["kind"] = "recurring"` and `save(update_fields=["metadata"])`.

`get_or_generate_report(household, month)` — idempotent; second call returns same DB row. Snapshot is frozen: mutating budgets afterward does NOT change `stats`.

`last_closed_month(household)` — returns previous calendar month as `"YYYY-MM"` in household tz.

`render_report(report, lang=..., polish=False)` — deterministic; in test environments gettext translations are not compiled, so FR and EN outputs are identical (msgids = English). Do NOT assert FR != EN in tests.

## Household timezone gotcha

`Household.timezone` is `CharField(default='', blank=True)` — NOT NULL in DB. To simulate "no timezone" in tests use `hh.timezone = ""` (not `None`, which raises psycopg `NotNullViolation`).

## Ping

`build_monthly_report_message(household, user, *, today: date)` — returns `None` when `today.day != 1` or when `expense_count == 0`; returns HTML string (`<b>header</b>\n\nbody`) on day 1 with expenses. Calls `get_or_generate_report` → persists a `BudgetReport` row as a side-effect.

## Test files created (parcours 21, Lot 3)

- `apps/budget/tests/test_report_stats.py`
- `apps/budget/tests/test_report_service.py`
- `apps/budget/tests/test_api_report.py`
- `apps/budget/tests/test_report_ping.py`
