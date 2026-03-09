# Implementation Plan: Migration Zones 1:1 Legacy vers Django

**Branch**: `003-migrate-zones-parity` | **Date**: 2026-03-04 | **Spec**: `/specs/003-migrate-zones-parity/spec.md`
**Input**: Feature specification from `/specs/003-migrate-zones-parity/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Porter l'expérience Zones legacy Next.js vers le runtime Django hybride en conservant le split React (hooks/composants/lib/types) et les comportements UX, avec une adaptation de contrat DRF localisée. L'exécution se fait en deux paliers: (1) liste/arbre + CRUD + parentage + couleurs, (2) détail zone + stats + galerie photo, avec vérification de parité continue et régression minimale.

## Technical Context

**Language/Version**: Python 3.x (Django 5), TypeScript (React 19)  
**Primary Dependencies**: Django, DRF, django-filter, drf-spectacular, React, Vite, django-vite, Tailwind  
**Storage**: PostgreSQL (runtime), SQLite in-memory (tests)  
**Testing**: pytest (apps/zones), Django test client, focused UI/manual parity checks  
**Target Platform**: Web app Django SSR + mini-SPA React (desktop/mobile browser)
**Project Type**: Django web application with per-page React mounts  
**Performance Goals**: Zone list/tree and detail first render remain within current app baseline; no observable regression in perceived load on standard household datasets  
**Constraints**: Strict legacy UX parity, no broad backend refactor, household scoping mandatory, i18n-safe UI strings, preserve mount pattern (`mount-zones.tsx`), and keep zone page bundle growth minimal (target <= +10% vs current zones entry)  
**Scale/Scope**: One app domain (`zones`), two web pages (`/app/zones/` and `/app/zones/{id}`), existing DRF ViewSet + custom actions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Pre-Phase 0 Check**

- [x] Django remains route/auth/permission authority for this feature.
- [x] Server/client boundary is explicit per screen (SSR shell, React mount, runtime API).
- [x] Every new/changed API has an updated contract in `contracts/`.
- [x] Household scope and access control rules are specified and testable.
- [x] User stories are independently testable with measurable success criteria.
- [x] Hybrid pages include tasks for mount point, initial data contract, and bundle budget.

**Post-Phase 1 Re-Check**

- [x] Design artifacts define SSR payload contracts for list and detail pages.
- [x] Contracts include changed behavior for deletion with children and stale update conflicts.
- [x] Household scoping is preserved on all list/detail/photos flows and API mutations.
- [x] Feature remains migration-safe (legacy as UX reference, runtime truth in Django/DRF).
- [x] i18n impact is identified (no hardcoded new UI strings outside existing translation system).

## Project Structure

### Documentation (this feature)

```text
specs/003-migrate-zones-parity/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
└── zones/
  ├── models.py
  ├── serializers.py
  ├── views.py
  ├── urls.py
  ├── views_web.py
  ├── web_urls.py
  ├── templates/zones/app/zones.html
  ├── react/
  │   ├── ZonesNode.tsx
  │   └── mount-zones.tsx
  └── tests.py

ui/
└── src/
  ├── pages/zones.tsx
  └── lib/api/zones.ts

templates/
└── app/ (shared app shell templates if needed)

config/
└── urls.py
```

**Structure Decision**: Conserver l'architecture Django-routed + mini-SPA React ciblés. Le travail est localisé à `apps/zones/` (API + web + React mount) avec un adaptateur de contrat côté front; aucune nouvelle app ni refonte transversale.

## Phase 0: Research Plan

1. Valider le pattern d'adaptation DRF ↔ shape legacy pour minimiser les changements UI.
2. Fixer la stratégie de gestion des conflits d'édition (stale update) compatible DRF.
3. Définir la stratégie de suppression parent/enfants cohérente avec la clarification validée.
4. Encadrer les contrats SSR initiaux (liste et détail) et les actions runtime API.

Output: `research.md`

## Phase 1: Design & Contracts Plan

1. Formaliser le modèle de données fonctionnel (entités, règles, transitions) dans `data-model.md`.
2. Définir les contrats d'interface de la feature dans `contracts/` (API et payloads page).
3. Rédiger un parcours d'exécution/validation de la migration dans `quickstart.md`.
4. Inclure la vérification du budget bundle zones dans la stratégie de validation.
5. Mettre à jour le contexte agent via script dédié.

Outputs: `data-model.md`, `contracts/*`, `quickstart.md`

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
