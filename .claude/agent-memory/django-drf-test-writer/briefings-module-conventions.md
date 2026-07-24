---
name: briefings-module-conventions
description: Briefings module — URL names, permission model, quota rule, factory pattern, resolve_briefing service
metadata:
  type: project
---

## URL names (router basename="briefing")
- List/create: `reverse("briefing-list")`
- Detail (UUID pk): `reverse("briefing-detail", args=[str(b.pk)])`
- Preview action: `reverse("briefing-preview", args=[str(b.pk)])` — POST, IsHouseholdMember only (no CanManageBriefing), any member who can see the briefing may preview; private from another user → 404.
- Send-now action: `reverse("briefing-send-now", args=[str(b.pk)])` — POST, IsHouseholdMember + CanManageBriefing (creator or household owner for shared); non-creator member → 403.

## Auth / household pattern
Tests use `_make_user(email)` + `_make_household(name)` + `_add_member(user, hh, role=…)` helpers (no factory shortcut for household).
`user.active_household` must be set and saved for the viewset's `request.household` to resolve correctly.

## Permission model (`CanManageBriefing`)
- **Read (GET/HEAD/OPTIONS)**: creator always; non-private shared briefings to any household member. Private briefing of another user → excluded from queryset → **404** (not 403).
- **Write (PATCH/DELETE)**: creator always; non-private shared briefing → household **owner** role also allowed; non-creator plain **member** → **403**.
- Anonymous → **401** at `IsHouseholdMember` before object-level check.
- Cross-household object → **404** (queryset filters by active household).

## Active briefings quota (`MAX_ACTIVE_BRIEFINGS_PER_USER = 10`)
- Quota is **per user**, not per household — another user's active briefings don't count.
- Only `is_active=True` creations/updates trigger the check; inactive briefings are unlimited.
- `update_briefing` excludes the briefing being updated from the count (`exclude_pk`), so patching an already-active briefing without exceeding quota is allowed.
- Both REST and service raise a `ValidationError` with key `"is_active"` when the quota is exceeded.

## Service signatures
- `create_briefing(household, user, *, title, prompt, condition="", channel, briefing_type, is_private, is_active) -> Briefing`
- `update_briefing(household, user, briefing, *, fields: dict) -> Briefing`
- `delete_briefing(briefing) -> None`
- `resolve_briefing(household, raw_id) -> Briefing | None` — returns None for unknown pk OR pk from another household.

## Serializer validation
- `validate_title`: strips whitespace, rejects blank → key `"title"`.
- `validate_prompt`: strips whitespace, rejects blank → key `"prompt"`.
- `validate_condition`: strips whitespace, allows blank (no error).

## Factory (`BriefingFactory`)
`BriefingFactory` in `apps/briefings/tests/factories.py`.
`household` and `created_by` are **not** subfactories — must be supplied by each test.
Default: `is_active=False`, `is_private=False`, `briefing_type=recurring`, `channel=telegram`.

## Test helper pattern (all test classes)
```python
def _create_briefing(self, household, user, **kwargs) -> Briefing:
    defaults = {"title": "...", "prompt": "...", "is_private": False}
    defaults.update(kwargs)
    return Briefing.objects.create(household=household, created_by=user, **defaults)

def _briefing_payload(self, **overrides):
    return {"title": "...", "prompt": "...", **overrides}
```

Direct ORM (`Briefing.objects.create`) is used in tests to seed data, bypassing the service quota — intentional for quota-boundary tests.

## Generation + Telegram delivery (`generation.py`)
- `generate_briefing_text(briefing, *, recipient) -> str` — calls `agent.service.ask` (import inside the function), strips `_CITE_RE` markers (`<cite id="..."/>`), cleans whitespace. Patch target: `agent.service.ask`.
- `_render_telegram(briefing, text) -> str` — `<b>{html.escape(title)}</b>\n\n{html.escape(body)}`. Test directly (no mock needed).
- `send_briefing_now(briefing, *, triggered_by) -> dict` — recipients = creator (private) or all HouseholdMembers (shared). Per-recipient fault isolation (one raise → errors++, others continue). `send_agent_message` returning False → errors++. Returns `{total_recipients, sent, skipped_no_telegram, errors}`. Patch targets: `agent.service.ask` + `telegram.outbound.send_agent_message`.
- `TelegramAccount` (OneToOne user, unique chat_id) must be created per-test; no factory exists — use `TelegramAccount.objects.create(user=user, chat_id=N)`.
- LLMTimeoutError and LLMError from `agent.llm` → preview endpoint returns 503 `{"detail": "generation_failed"}`.

## Related memories
- [[shopping-module-conventions]] — similar any-member vs owner-only write split
- [[budget-module-conventions]] — any-member write contrast
