# Implementation Plan: Traiter un document entrant et le relier au bon contexte

**Branch**: `001-document-context-linking` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-document-context-linking/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Transformer la surface documents actuelle en vrai parcours de qualification: ajout réel par upload multipart, redirection immédiate vers un détail document Django-routé, calcul produit du statut `sans contexte` à partir de `InteractionDocument`, rattachement à une activité existante via sélection “récentes + recherche simple”, et création d’activité depuis le document via extension atomique du flux interactions existant avec `document_ids`.

## Technical Context

**Language/Version**: Python 3.x (Django 5.2.11), TypeScript 5.9.x (React 19)  
**Primary Dependencies**: Django, DRF, django-filter, drf-spectacular, django-vite, React, i18next/react-i18next, Tailwind CSS, Lucide  
**Storage**: PostgreSQL au runtime, SQLite in-memory pour les tests, fichiers stockés dans `MEDIA_ROOT` avec persistance du chemin dans `Document.file_path`  
**Testing**: pytest + DRF APIClient + validation manuelle ciblée pour les pages hybrides  
**Target Platform**: Application web Django hybride (SSR shell + mini-SPA React ciblés)
**Project Type**: Feature web dans un repo Django/DRF + React existant  
**Performance Goals**: pas de premier rendu vide sur liste/création/détail; redirection post-upload vers le détail en < 5 s; conserver un bundle documents raisonnable avec pages séparées  
**Constraints**: Django reste autorité des routes/auth/permissions; household scope obligatoire; conserver `Document.file_path` en V1; éviter un refactor large du domaine documents; support i18n `en/fr/de/es`; budget bundle cible <= +15 % pour l’entrée liste existante avec nouvelles pages isolées  
**Scale/Scope**: 3 pages hybrides (`/app/documents/`, `/app/documents/new/`, `/app/documents/<id>/`), 2 apps Django principalement touchées (`documents`, `interactions`), 4-5 contrats API modifiés/ajoutés, datasets à l’échelle d’un foyer (documents récents et activités récentes)

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

- [x] Design artifacts keep Django as route owner for list/create/detail and for the interaction handoff flow.
- [x] SSR/runtime boundaries are defined in [contracts/documents-web-contract.md](./contracts/documents-web-contract.md) for each screen.
- [x] Changed API contracts are documented in [contracts/document-context-api.yaml](./contracts/document-context-api.yaml).
- [x] Household scope, duplicate prevention, and atomic interaction-link creation are explicit in [data-model.md](./data-model.md).
- [x] Feature remains migration-safe: `Document.interaction` stays compatibility-only while `InteractionDocument` becomes product truth.
- [x] i18n impact is captured for all four React locale files and Django SSR strings.

## Project Structure

### Documentation (this feature)

```text
specs/001-document-context-linking/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── document-context-api.yaml
│   └── documents-web-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── core/
│   └── views.py
├── documents/
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   ├── views_web.py
│   ├── web_urls.py
│   ├── react/
│   │   ├── DocumentsPage.tsx
│   │   ├── DocumentListItem.tsx
│   │   ├── DocumentsFilters.tsx
│   │   ├── EditDocumentModal.tsx
│   │   └── (new detail/create components)
│   └── tests/
│       └── test_api_documents.py
├── interactions/
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── views_web.py
│   ├── web_urls.py
│   ├── react/
│   │   └── InteractionCreateForm.tsx
│   └── tests/
│       └── test_api_interactions.py
├── zones/
│   └── models.py
└── projects/
    └── models.py

ui/
├── src/
│   ├── lib/
│   │   ├── api/
│   │   │   ├── documents.ts
│   │   │   └── interactions.ts
│   │   └── mount.tsx
│   ├── pages/
│   │   ├── documents/
│   │   │   ├── list.tsx
│   │   │   ├── new.tsx
│   │   │   └── detail.tsx
│   │   └── interactions/
│   │       └── new.tsx
│   └── locales/
│       ├── en/translation.json
│       ├── fr/translation.json
│       ├── de/translation.json
│       └── es/translation.json
└── vite.config.ts

locale/
└── {en,fr,de,es}/LC_MESSAGES/django.po
```

**Structure Decision**: Suivre strictement l’architecture Django-routed + mini-SPA React ciblés du repo. Le cœur de la feature vit dans `apps/documents/`, avec extension localisée du flux `interactions` pour la création atomique depuis un document. Les nouveaux écrans documents reçoivent chacun un entrypoint Vite dédié.

## Phase 0: Research Plan

1. Valider la stratégie d’upload réel compatible avec `Document.file_path` et le media storage actuel.
2. Fixer la vérité produit `InteractionDocument` vs compatibilité `Document.interaction`.
3. Définir la boundary SSR/runtime pour les pages liste, création et détail.
4. Définir le flux sûr de création d’activité depuis un document sans open redirect ni double appel fragile.
5. Encadrer explicitement l’i18n et le budget bundle avant implémentation.

Output: `research.md`

## Phase 1: Design & Contracts Plan

1. Formaliser les entités et projections métier de la feature dans `data-model.md`.
2. Définir les contrats API de l’upload, du détail document enrichi, du rattachement d’activité et de la création d’activité avec `document_ids` dans `contracts/document-context-api.yaml`.
3. Définir les contrats SSR/runtime des pages documents et du handoff vers la page interactions dans `contracts/documents-web-contract.md`.
4. Rédiger le parcours de validation manuelle et les vérifications d’API dans `quickstart.md`.
5. Prévoir dans les tâches ultérieures la couverture tests API, les points de mount React, les props initiales, le contrôle du budget bundle et la régénération du client TypeScript généré après évolution des contrats.

Outputs: `data-model.md`, `contracts/*`, `quickstart.md`

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
