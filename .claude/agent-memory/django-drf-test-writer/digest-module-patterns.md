---
name: digest-module-patterns
description: Patching conventions and gotchas for the agent.digest module (parcours 18) — SECTION_SPECS, lazy imports, collector functions
metadata:
  type: project
---

## Digest module monkeypatching rules (learned 2026-07-16)

### The lazy-import problem for collectors
`collect_weather`, `collect_electricity`, `collect_chickens` all use `from <module> import <fn>` **inside the function body** (lazy to avoid circular imports). As a result:

- Patching `agent.digest.collectors.evaluate_weather_alerts` — **FAILS** (attribute doesn't exist on the module)
- Patching `weather.alerts.evaluate_weather_alerts` — **WORKS** (the lazy from-import picks up the patched version each call)
- Same for `electricity.services.consumption_summary` and `chickens.services.egg_stats`

### The SECTION_SPECS binding problem for service tests
`agent.digest.service` does `from .collectors import SECTION_SPECS` at module load time. `build_digest` and `active_section_specs` reference `SECTION_SPECS` as a module-level name in `service.py`.

- Patching `agent.digest.collectors.SECTION_SPECS` — **FAILS** (service.py already has its own binding)
- Patching `agent.digest.service.SECTION_SPECS` — **WORKS**

### egg_stats signature
`chickens.services.egg_stats(household, *, today=None)` — `today` is keyword-only.
Lambda must be: `lambda hh, *, today=None: {...}`

### IsHouseholdMember permissiveness
`IsHouseholdMember` only checks membership when a household ID is explicitly provided (header/query/body). An authenticated user with **no household** passes the permission check and gets `request.household = None`. Testing "no household → 403" is invalid for this permission class.

### URL name
`agent-digest` → `GET /api/agent/digest/`

### User.digest_disabled_sections
- `JSONField(default=list)` on the User model
- Validated by `validate_digest_disabled_sections` in `accounts/serializers.py`
- Valid keys: from `agent.digest.collectors.SECTION_KEYS`
- Rejects unknown keys (400), rejects non-list (400), deduplicates valid keys
- Exposed and patchable via `PATCH /api/accounts/users/me/` (URL name: `user-me`)

**Why:** These patterns are non-obvious and cause AttributeError/wrong-test failures if patched at the wrong target.

**How to apply:** Any test touching digest collectors or build_digest must follow these rules. Do not guess at the attribute location — verify with the lazy import pattern.
