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
- `./JOURNAL_PRODUIT.md` — living product journal and current state hub
- `./IDEES_FUTURES.md` — backlog of future ideas, RFCs, and deferred product directions
- `./PARCOURS_METIER_PRIORITAIRES.md` — recommended first business journeys and weekly delivery cadence
- `./PARCOURS_01_CAPTURER_ET_RETROUVER_UN_EVENEMENT.md` — detailed product brief for the first business journey
- `./PARCOURS_01_BACKLOG_TECHNIQUE.md` — concrete technical backlog for implementing the first business journey
- `./PARCOURS_01_CAPTURE_ASSISTEE_PAR_IA.md` — future-facing note on AI-assisted event capture aligned with journey 1

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
