# Documentation Hub

Documentation active du projet **House**. Mise à jour : avril 2026.

Architecture courante : **SPA pure** — backend Django/DRF (API REST + JWT) + frontend React unique (`ui/src`) routé par `react-router`.

Parcours 01→06 livrés. Voir `JOURNAL_PRODUIT.md` pour le détail.

## Scope et source de vérité

- Runtime source of truth : `config/`, `apps/`, `ui/src/`
- **Backlog** : [GitHub issues](https://github.com/jammindev/house/issues), filtrable par label `app:<name>`
- En cas de conflit doc ↔ code, le code gagne.

## Lire en priorité

- `../AGENTS.md` — vue d'ensemble du repo, conventions
- `../CLAUDE.md` — règles projet (workflow git, commandes, i18n, composants UI)
- `./MODULES/README.md` — référence architecturale par module
- `./FEATURE_PATTERN.md` — pattern à suivre pour toute nouvelle feature React
- `./JOURNAL_PRODUIT.md` — journal des parcours métier livrés et en cours

## Product and domain

- `./PRODUCT_OVERVIEW.md` — intent, capabilities and boundaries
- `./DOMAIN_MODEL_INTERACTIONS.md` — interaction-centric domain model
- `./ARCHITECTURE.md` — backend/frontend stack et organisation

## Parcours métier

- `./parcours/PARCOURS_01_*.md` — capturer / retrouver un événement
- `./parcours/PARCOURS_02_*.md` — traiter un document entrant
- `./parcours/PARCOURS_03_*.md` — transformer un besoin en action
- `./parcours/PARCOURS_04_*.md` — suivre un projet de bout en bout
- `./parcours/PARCOURS_05_*.md` — naviguer par zone ou équipement
- `./parcours/PARCOURS_06_*.md` — alertes proactives
- `./parcours/PARCOURS_07_*.md` — agent conversationnel sur le foyer (V1 livrée 2026-05-02, lots 0a→3)

## RFC et notes thématiques

- `./SYNC_CONTACTS_STRUCTURES.md` — RFC vCard pour le directory
- `./parcours/PARCOURS_IA_TRANSVERSE.md` — note chapeau de la couche IA (principes communs aux parcours 01 et 02)

## App-level docs

- `../apps/electricity/react/README.md`

Additional app docs should be added under each app when behavior is specific to one domain and not cross-cutting.
