---
name: codebase-patterns
description: Factories, viewset naming, auth pattern, and membership model for the house project test suite
metadata:
  type: user
---

## Factories

- Located in `apps/<app>/tests/factories.py`
- All apps share the same `UserFactory` / `HouseholdFactory` / `HouseholdMemberFactory` pattern (each app redefines them locally)
- Reference factories are in `apps/electricity/tests/factories.py` and `apps/accounts/tests/factories.py`
- `UserFactory._create` pops `password` and calls `create_user` — do not use `DjangoModelFactory` defaults for User
- `WaterReadingFactory` is in `apps/water/tests/factories.py` (new, created during water app test session)
- Factory fields `created_by` / `updated_by` are always `SubFactory(UserFactory)` / `SelfAttribute("created_by")`

## Auth / Household membership pattern

- `HouseholdMember.Role` has `.OWNER` and `.MEMBER` values
- To give a user an active household (required by `ActiveHouseholdMiddleware`):
  ```python
  user.active_household = household
  user.save(update_fields=["active_household"])
  ```
- Shared helpers used in every test file:
  ```python
  def _make_owner(household): ...
  def _make_member(household): ...
  def _client_for(user) -> APIClient: ...  # uses force_authenticate
  def _anon_client() -> APIClient: ...
  ```

## Viewset URL naming

- Router basename pattern: `<app>-<resource>-list` / `<app>-<resource>-detail`
- Examples:
  - `water-reading-list` / `water-reading-detail`
  - `electricity-board-list` / `electricity-board-detail`
  - `electricity-meter-list` / `electricity-meter-detail`
- Named URL (non-router): `water-consumption-summary`

## Water app specifics

- `WaterReading(HouseholdScopedModel)` — UUID pk, unique on (household, reading_date)
- Serializer validates: index >= 0, no lower than previous, no higher than next, unique date per household
- Services: `create_water_reading`, `update_water_reading`, `consumption_summary`
- `consumption_summary` returns `{granularity, date_from, date_to, total_l, buckets[{ts, total_l}]}`
- Agent: WritableSpec `water_reading` (entity_type), ListableSpec with `date_from`/`date_to` filters
- comma decimal accepted by `_create_reading_from_agent` via `.replace(',', '.')`

## Agent test pattern

- Use `tools.dispatch("create_entity", tool_input, household=hh, user=user)` — returns `ToolResult`
- `ToolResult.created` is a list of dicts; `ToolResult.updated` similarly
- For recoverable errors: `result.created` is empty, `result.rendered` has the error message
- Access specs directly: `agent.writables.find_spec("water_reading")`, `agent.listables.find_spec("water_reading")`
- `agent.listables.filter_names(spec)` returns filter names in declaration order
- Always import `from agent import tools`, `from agent import writables as agent_writables`, `from agent import listables as agent_listables`

## Cross-household isolation

- Views filter by `request.household` (set from `user.active_household` by middleware)
- Cross-household detail → 404 (not 403) because the queryset is already scoped
- Agent `resolve` function must also scope by household — WritableSpec.resolve receives `(household, raw_id)`

## Serializer test pattern

```python
def _make_request(household):
    request = MagicMock()
    request.household = household
    return request

def _ser(data, household, instance=None, partial=False):
    request = _make_request(household)
    return WaterReadingSerializer(instance=instance, data=data, partial=partial, context={"request": request})
```
