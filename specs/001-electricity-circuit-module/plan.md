# Implementation Plan: Module Électricité Maison

**Branch**: `001-electricity-circuit-module` | **Date**: 2026-02-26 | **Spec**: [/specs/001-electricity-circuit-module/spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-electricity-circuit-module/spec.md`

## Summary

Créer une mini-app `electricity` intégrée au projet Django en migration, avec rendu principal via template Django dédié et contexte complet injecté par vue serveur. Ajouter des nœuds React ciblés uniquement pour les interactions complexes (visualisation interactive des correspondances), en passant explicitement les props depuis la vue Django, conformément au pattern hybride existant (`django-vite` + montage ciblé).

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5 + React 19 (frontend ciblé)  
**Primary Dependencies**: Django 5, Django REST Framework, django-filter, django-vite, React 19, Vite  
**Storage**: PostgreSQL (local/prod), SQLite in-memory pour tests  
**Testing**: pytest (Django/DRF), tests API et permissions multi-tenant  
**Target Platform**: Application web server-rendered Django avec enrichissement React ciblé
**Project Type**: Web application (Django-first + React islands)  
**Performance Goals**: Rechercher une correspondance disjoncteur/circuit/point d’usage en <10s côté usage réel; endpoints de listing filtré en p95 <300ms en dataset MVP  
**Constraints**: Multi-tenant strict (household), édition owner-only, soft delete pour associations, unicité globale des repères par foyer, support triphasé avec phase par circuit (L1/L2/L3), éviter refactor large  
**Scale/Scope**: Mini-app foyer, périmètre MVP: cartographie tableau/circuits/protections/points d’usage, consultation bidirectionnelle, maintenance des associations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Statut fichier constitution: `.specify/memory/constitution.md` ratifiée avec principes normatifs version 1.0.0.
- Gate 1 (principes obligatoires): PASS (principes I à V intégrés dans le plan et les artefacts).
- Gate 2 (contraintes obligatoires): PASS (multi-tenant, owner-write/member-read, contrat API-first respectés).
- Gate 3 (gouvernance): PASS (workflow spec/plan/tasks/contracts aligné).

**Post-Design Re-check**: PASS. Les artefacts Phase 0/1 restent alignés avec l’architecture projet (Django-first, React ciblé) et avec les contraintes métier de la spec.

## Project Structure

### Documentation (this feature)

```text
specs/001-electricity-circuit-module/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── electricity-api.yaml
│   └── electricity-template-context.md
└── tasks.md
```

### Source Code (repository root)

```text
electricity/
├── __init__.py
├── apps.py
├── models.py
├── serializers.py
├── urls.py
├── views.py
├── admin.py
├── migrations/
└── tests/

templates/
└── app/
    └── electricity.html

frontend/
└── src/
    ├── electricity/
    │   ├── ElectricityBoardNode.tsx
    │   └── mount-electricity.tsx
    └── lib/
        └── mount.tsx

config/
└── urls.py
```

**Structure Decision**: Conserver la structure web existante et ajouter une app Django dédiée `electricity` + template SSR dédié. Le composant React est isolé à un nœud de visualisation complexe monté depuis le template via props JSON générées côté vue Django.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Aucun | N/A | N/A |
