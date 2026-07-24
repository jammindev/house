# Agent Memory Index

- [Factory vs API for side-effects](feedback_factory_vs_api_for_side_effects.md) — Use API calls not factories when testing service-layer side-effects like rebuild_reading_records
- [Electricity consumption patterns](project_electricity_consumption_patterns.md) — Viewset URL names, duplicate reading_at serializer/DB behavior, honesty rule, household activation pattern
- [Electricity module conventions](electricity-module-conventions.md) — factories, URL names, auth pattern, UUID comparison gotcha
- [Water app / general codebase patterns](codebase-patterns.md) — water factories, viewset naming, agent dispatch pattern, AgentMemory patterns, cross-household isolation gotcha
- [Digest module patching patterns](digest-module-patterns.md) — SECTION_SPECS binding gotcha, lazy-import targets for weather/electricity/chickens, egg_stats signature, user-me URL name
- [Shopping module conventions](shopping-module-conventions.md) — URL names, checked/checked_at mapping, REST create gotcha (checked ignored), from-stock dedup rules, agent parity contract
- [Budget module conventions](budget-module-conventions.md) — URL names, any-member write policy, SET_NULL on expense delete, agent parity contract, LookupError undo contract
- [Briefings module conventions](briefings-module-conventions.md) — URL names, private/shared permission model, per-user quota (10), resolve_briefing service, factory pattern
