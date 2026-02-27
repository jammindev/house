<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0
- Modified principles:
  - III. Contract-First API & UI Boundary: ajout mention client API généré (gen:api OpenAPI)
  - V. Migration Safety: correction du chemin `frontend/` → `ui/`
- Added sections: None
- Removed sections: None
- Technical Standards enrichis:
  - Alpine.js, HTMX, Tailwind CSS, Lucide ajoutés
  - Pattern mini-SPA par page explicité (web-components supprimés, ne pas réintroduire)
  - Client API (gen:api OpenAPI) formalisé comme source de vérité des types React
  - Détails scoping multi-tenant (HouseholdScopedModel, résolution X-Household-Id)
- Templates requiring updates:
  - ✅ no change needed: .specify/templates/plan-template.md (templates génériques)
  - ✅ no change needed: .specify/templates/spec-template.md
  - ✅ no change needed: .specify/templates/tasks-template.md
  - ✅ no change needed: .specify/templates/checklist-template.md
  - ✅ no change needed: .specify/templates/agent-file-template.md
- Runtime guidance docs:
  - ✅ AGENTS.md: à jour (source de vérité runtime)
  - ✅ README.md: à jour
- Follow-up TODOs: None
-->

# House Constitution

## Core Principles

### I. Django-Routed Hybrid UI (MUST)
- Django DOIT rester le point d’entrée des routes, de l’auth session, des permissions et du shell SSR.
- Chaque page métier PEUT embarquer un mini-SPA React dédié, mais la frontière serveur/client
  DOIT être explicite et documentée dans la spec.
- Une même responsabilité métier (source de vérité d’un écran) NE DOIT PAS être dupliquée
  entre template Django et React.

### II. Household Scope & Access Control (MUST)
- Toute donnée métier DOIT être scopée par `household`.
- Les lectures DOIVENT être limitées aux membres du foyer.
- Les écritures sensibles DOIVENT respecter la règle owner-write/member-read quand la spec l’exige.

### III. Contract-First API & UI Boundary (MUST)
- Tout endpoint API exposé DOIT avoir un contrat dans `specs/<feature>/contracts/`.
- Le contrat DOIT être aligné avec la spec fonctionnelle (pas d’écart CRUD implicite).
- Pour chaque écran hybride, la spec DOIT préciser la limite entre données SSR initiales,
  hydratation React et appels API runtime.
- Les changements de contrat DOIVENT être reflétés dans les tests API.
- Le client TypeScript généré (`npm run gen:api` depuis le schéma OpenAPI) DOIT être considéré
  la source de vérité pour les types d’API dans le code React; il DOIT être regénéré après
  tout changement de contrat.

### IV. Story-Independent Verification (MUST)
- Les exigences critiques (permissions, contraintes, règles de cohérence) DOIVENT avoir des tests dédiés.
- Les Success Criteria mesurables de la spec DOIVENT être vérifiés par des tâches explicites.
- Chaque user story DOIT rester testable indépendamment, y compris en mode page hybride
  (template + mini-SPA).

### V. Migration Safety (MUST)
- Le dossier `legacy/` sert de documentation fonctionnelle, pas de base de code à copier.
- Les implémentations DOIVENT respecter le code actif (`config/`, apps Django, `templates/`, `ui/`).
- Les refactors larges hors périmètre DOIVENT être évités.

## Technical Standards

- **Backend**: Django 5 + DRF; auth session Django (cookies + CSRF); permissions via `core.permissions`.
- **Frontend — SSR léger**: Alpine.js (interactions UI légères) + HTMX (`hx-boost` navigation SPA-like)
  pour les pages sans mini-SPA React.
- **Frontend — mini-SPA**: React 19 + TypeScript + Vite; intégration via `django-vite`;
  un mini-SPA React par page (pattern `apps/<app>/react/` + point de montage `mount-<app>.tsx`).
  Les Web Components (`<ui-*>`) NE DOIVENT PAS être réintroduits; le pattern mini-SPA ciblé prévaut.
- **Design system**: composants atomiques React dans `ui/src/design-system/`
  (Button, Input, Card, Select, Textarea, Badge, Alert, Skeleton); stylés Tailwind CSS + icônes Lucide.
- **Client API**: généré depuis le schéma OpenAPI (`npm run gen:api`); sortie dans `ui/src/gen/api/`.
  Ce client DOIT être regénéré après tout changement de contrat.
- **Base de données**: PostgreSQL (runtime), SQLite in-memory (tests).
- **Scoping multi-tenant**: `HouseholdScopedModel` + `HouseholdScopedManager`; résolution household
  via header `X-Household-Id` → query param → auto-select si membre unique.

## Workflow & Quality Gates

- `spec.md`, `plan.md`, `tasks.md` et `contracts/` DOIVENT être cohérents entre eux avant implémentation.
- Les tâches DOIVENT être organisées par user story pour permettre une livraison incrémentale indépendante.
- Les checklists de feature DOIVENT être complètes avant exécution du mode implement,
  sauf décision explicite de poursuivre.
- Toute page hybride DOIT inclure des tâches explicites pour: point de montage React,
  contrat de données initiales, tests de permissions, et budget de bundle raisonnable.

## Governance

- Cette constitution prévaut sur les préférences locales en cas de conflit de processus.
- Toute modification de principe DOIT inclure justification, impact migration et date d’amendement.
- Politique de version de constitution:
  - MAJOR: suppression/redéfinition incompatible d’un principe.
  - MINOR: ajout d’un principe/section, ou extension normative significative.
  - PATCH: clarification éditoriale sans impact de gouvernance.
- Chaque PR/lot de changement DOIT vérifier la conformité aux principes I à V.
- Une revue de conformité constitutionnelle DOIT être effectuée à minima lors de chaque
  cycle de planification feature (`spec`/`plan`/`tasks`).

**Version**: 1.2.0 | **Ratified**: 2026-02-26 | **Last Amended**: 2026-02-27
