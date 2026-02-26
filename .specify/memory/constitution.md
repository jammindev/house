# House Constitution

## Core Principles

### I. Django-First Architecture (MUST)
- Le rendu principal des pages métier DOIT être assuré par Django templates.
- React DOIT être utilisé uniquement pour des îlots UI complexes et ciblés.
- Toute nouvelle feature DOIT d’abord fournir un fallback SSR utilisable sans JavaScript.

### II. Household Scope & Access Control (MUST)
- Toute donnée métier DOIT être scoppée par `household`.
- Les lectures DOIVENT être limitées aux membres du foyer.
- Les écritures sensibles DOIVENT respecter la règle owner-write/member-read quand la spec l’exige.

### III. Contract-First API (MUST)
- Tout endpoint API exposé DOIT avoir un contrat dans `specs/<feature>/contracts/`.
- Le contrat DOIT être aligné avec la spec fonctionnelle (pas d’écart CRUD implicite).
- Les changements de contrat DOIVENT être reflétés dans les tests API.

### IV. Tests & Measurable Outcomes (MUST)
- Les exigences critiques (permissions, contraintes, règles de cohérence) DOIVENT avoir des tests dédiés.
- Les Success Criteria mesurables de la spec DOIVENT être vérifiés par des tâches explicites.
- Aucune feature n’est considérée prête sans validation des scénarios indépendants par user story.

### V. Migration Safety (MUST)
- Le dossier `legacy/` sert de documentation fonctionnelle, pas de base de code à copier.
- Les implémentations DOIVENT respecter le code actif (`config/`, apps Django, `templates/`, `frontend/`).
- Les refactors larges hors périmètre DOIVENT être évités.

## Technical Standards

- Backend principal: Django 5 + DRF.
- Frontend ciblé: React 19 + Vite via `django-vite`.
- Base de données: PostgreSQL (runtime), SQLite in-memory (tests).
- Conventions de permissions et scoping alignées sur `core.permissions` et patterns existants.

## Workflow & Quality Gates

- `spec.md`, `plan.md`, `tasks.md` et `contracts/` DOIVENT être cohérents entre eux avant implémentation.
- Les tâches DOIVENT être organisées par user story pour permettre une livraison incrémentale indépendante.
- Les checklists de feature DOIVENT être complètes avant exécution du mode implement, sauf décision explicite de poursuivre.

## Governance

- Cette constitution prévaut sur les préférences locales en cas de conflit de processus.
- Toute modification de principe DOIT inclure justification, impact migration et date d’amendement.
- Chaque PR/lot de changement DOIT vérifier la conformité aux principes I à V.

**Version**: 1.0.0 | **Ratified**: 2026-02-26 | **Last Amended**: 2026-02-26
