# Documentation Hub

Documentation active du projet **House**. Mise à jour : avril 2026.

Architecture courante : **SPA pure** — backend Django/DRF (API REST + JWT) + frontend React unique (`ui/src`) routé par `react-router`.

Phase produit en cours : parcours métier 06 (alertes proactives). Parcours 01–05 livrés. Voir `JOURNAL_PRODUIT.md`.

## Scope et source de vérité

- Runtime source of truth : `config/`, `apps/`, `ui/src/`
- Archive historique : branche git `archive/legacy` (supprimée du `main`)
- En cas de conflit doc ↔ code, le code gagne.

## Lire en priorité

- `../AGENTS.md` — vue d'ensemble du repo, conventions
- `./MODULES/README.md` — **état détaillé par module** (à corriger / à faire / à améliorer)
- `./FEATURE_PATTERN.md` — pattern à suivre pour toute nouvelle feature React
- `./JOURNAL_PRODUIT.md` — journal des parcours métier livrés et en cours

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
