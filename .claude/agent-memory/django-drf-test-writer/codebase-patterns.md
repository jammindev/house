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
- When testing cross-household: adding a user to a 2nd household with `_add_member` overwrites `active_household`.
  Use bare `HouseholdMember.objects.create(...)` without updating `active_household` when you need a user in
  multiple households but want the API to still resolve the original one.

## Agent memory (manage_memory tool + AgentMemoryViewSet)

- URL basename: `agent-memory` → `agent-memory-list` / `agent-memory-detail`
- `AgentMemory` is a `HouseholdScopedModel` with UUID pk, `content` (max 500), ordering `["-updated_at"]`
- Service: `memory_service.save_memory(household, user, content)` — validates via serializer + trims cap
- `MEMORY_LIMIT = 50` — saving the 51st drops the oldest by `updated_at`
- `resolve_memory` returns None for wrong user/household/invalid UUID. Django raises
  `django.core.exceptions.ValidationError` (not `ValueError`) for invalid UUID pk lookups — add both to the except.
- `ToolResult.memories` — list of `{action, id, content}` (save/update/forget events)
- Prompt: `build_system_prompt(memory_mode="auto", memories=[...])` injects content + `memory_id=<pk>`;
  `"manual"` adds the tool description but no memory block; `None` omits memory entirely
- `service.ask` result has `metadata["memory_events"]` — empty list when no memory tool was called
- `user.agent_memory_enabled` defaults to `True`; set to `False` for manual mode
- Clear action lives at `DELETE /api/agent/memories/clear/` (custom action, not a router detail route)

## Interactions app — renovation (parcours 13)

- URL names: `interaction-renovation-create` (POST list action) and `interaction-renovation-update` (PATCH detail with pk)
- All other `InteractionViewSet` URL names: `interaction-list`, `interaction-detail`, `interaction-expenses-manual`, `interaction-expenses-summary`, `interaction-by-type`, `interaction-tasks`, `interaction-update-status`
- `Interaction` has a DB check constraint `interactions_occurred_at_required_for_non_todo`: `occurred_at` is NOT NULL for any type except `todo`. Direct `Interaction.objects.create(type="note", ...)` in tests MUST include `occurred_at=timezone.now()`.
- `RENOVATION_ELEMENTS` keys: paint, floor, wall, ceiling, joinery, plumbing, electrical, heating, furniture, other
- `RENOVATION_TYPES`: installation, replacement, upgrade, repair, maintenance
- `metadata.kind == "renovation"` is the discrimination key; `metadata.element`, `product`, `brand`, `reference` are the structured fields
- Agent bridge `_create_renovation_from_agent` is in `apps/interactions/apps.py`; anchor type `"zone"` auto-appends zone to `zone_ids`
- Parity test pattern: call REST endpoint + call `_create_renovation_from_agent` directly, assert `type`, `metadata` keys, and zone M2M match
- `create_renovation_interaction`: requires at least one zone — empty/None `zone_ids` raises `ValueError("at least one zone is required")`
- `update_renovation_interaction`: rejects non-renovation entries (`ValueError("not a renovation entry")`), blank subject (`ValueError("subject cannot be blank")`), wrong household (`ValueError("belongs to another household")`)
- `delete_renovation_interaction`: same guards as update

## Chickens module (parcours 14)

- URL basenames: `chicken-list/detail`, `chicken-egg-log-list/detail`, `chicken-event-list/detail`
- Named URLs (non-router): `chicken-settings` (GET/PUT APIView), `chicken-summary` (GET APIView)
- URL action: `chicken-purchase` (POST detail action, `reverse("chicken-purchase", args=[pk])`)
- Factories: `ChickenFactory`, `EggLogFactory`, `ChickenEventFactory` in `apps/chickens/tests/factories.py`
- `EggLog` upsert: POST same (household, date) → 201 first time, 200 on update; service is `log_eggs()` returning `(egg_log, created)`
- Status→event: PATCH `status=deceased` → auto-creates `ChickenEvent(type=death)` only when status _changes_; `status=gone` → type=departure
- `Chicken.FLOCK_STATUSES = (active, broody, sick)` — summary `active_count` excludes deceased/gone
- `EggLogStats` endpoint URL name: `chicken-egg-log-stats` (list action, no `args`)
- `ChickenSettings` per-household: GET get-or-create, PUT `feed_tracker` must be kind=consumption and same household
- Tracker for settings tests: `Tracker.objects.create(household=hh, kind="consumption", ...)` — no factory shortcut
- Purchase interaction metadata key: `metadata["kind"] == "chickens_purchase"`, `metadata["amount"]` as string decimal
- Agent writables: `chicken` (with update, resolve, delete + `updatable_fields`) and `egg_log` (create+resolve+delete, no update)
- Agent listables: `chicken` (filters: status, in_flock), `egg_log` (filters: date_from, date_to)
- Agent searchables: `chicken` and `chicken_event`
- `_delete_chicken_from_agent` / `_delete_egg_log_from_agent` raise `LookupError` (not ValueError) when not found
- `ChickenEventSerializer.validate_chicken` checks `str(value.household_id) != str(household_id)` — requires household_id in serializer context

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
