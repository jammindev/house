# Documentation Hub

This folder contains the **active documentation** for the Django-first House codebase.

## Scope and source of truth

- Runtime source of truth: `config/`, `apps/`, `templates/`, `ui/`
- Historical reference: `legacy/` (kept for migration context)
- If legacy docs conflict with runtime code, runtime code wins.

## Read first

- `../AGENTS.md` — repository-wide context, app map, conventions
- `./HYBRID_ARCHITECTURE.md` — Django + React integration model
- `./AI_CONTEXT_API.md` — API context and endpoint references
- `./AI_CONTEXT_MIGRATION.md` — migration context (legacy -> active)

## Product and domain

- `./PRODUCT_OVERVIEW.md` — product intent, capabilities, and boundaries in current stack
- `./DOMAIN_MODEL_INTERACTIONS.md` — interaction-centric domain model and entities
- `./FEATURE_STATUS_AND_RFCS.md` — active modules vs RFC/legacy feature docs

## Engineering process

- `./CONTRIBUTING_AI.md` — AI-safe contribution workflow for this Django repo
- `./OPENAPI_TYPESCRIPT.md` — OpenAPI and TypeScript client generation
- `./README_MIGRATION_REACT.md` — progressive React migration patterns
- `./README_ATOMIC_COMPONENTS.md` — design-system component usage

## Legacy archive policy

- `./LEGACY_ARCHIVE_POLICY.md` — how legacy docs are retained and consumed
- `../legacy/README.md` — legacy archive entrypoint

## App-level docs

- `../apps/electricity/react/README.md`

Additional app docs should be added under each app when behavior is specific to one domain and not cross-cutting.
