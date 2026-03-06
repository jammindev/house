# Documentation Hub

This folder contains the **active documentation** for the Django-first House codebase.

Project status (March 2026): Django stack fully active; primary roadmap is UI completion for all apps.

## Scope and source of truth

- Runtime source of truth: `config/`, `apps/`, `templates/`, `ui/`
- Historical archive: `legacy/` (kept for reference)
- If legacy docs conflict with runtime code, runtime code wins.

## Read first

- `../AGENTS.md` — repository-wide context, app map, conventions
- `./HYBRID_ARCHITECTURE.md` — Django + React integration model
- `./AI_CONTEXT_API.md` — API context and endpoint references
- `./AI_CONTEXT_MIGRATION.md` — stack active context and working principles

## Product and domain

- `./PRODUCT_OVERVIEW.md` — product intent, capabilities, and boundaries in current stack
- `./DOMAIN_MODEL_INTERACTIONS.md` — interaction-centric domain model and entities
- `./FEATURE_STATUS_AND_RFCS.md` — active modules vs RFC/legacy feature docs

## Engineering process

- `./CONTRIBUTING_AI.md` — AI-safe contribution workflow for this Django repo
- `./OPENAPI_TYPESCRIPT.md` — OpenAPI and TypeScript client generation
- `./README_REACT_UI.md` — React UI architecture and patterns
- `./README_ATOMIC_COMPONENTS.md` — design-system component usage

## Historical archive

- `../legacy/README.md` — legacy archive entrypoint

## App-level docs

- `../apps/electricity/react/README.md`

Additional app docs should be added under each app when behavior is specific to one domain and not cross-cutting.
