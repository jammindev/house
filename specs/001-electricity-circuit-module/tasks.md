# Tasks: Module Électricité Maison

**Input**: Design documents from `/specs/001-electricity-circuit-module/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Les tests sont inclus car explicitement demandés dans `quickstart.md` ("Tests minimaux à ajouter").

**Organization**: Tasks grouped by user story to keep each story independently implementable and testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialiser la mini-app Django et la surface template/React de base.

- [X] T001 Créer l’app Django `electricity` avec fichiers de base dans electricity/apps.py, electricity/__init__.py, electricity/models.py, electricity/views.py, electricity/serializers.py, electricity/urls.py, electricity/admin.py et electricity/tests/__init__.py
- [X] T002 Enregistrer l’app et les routes API dans config/settings/base.py et config/urls.py
- [X] T003 [P] Ajouter la route HTML de mini-app `/app/electricity/` vers `app_electricity_view` dans config/urls.py
- [X] T004 [P] Créer le template dédié de mini-app dans templates/app/electricity.html
- [X] T005 [P] Créer le scaffold frontend ciblé pour le nœud React dans frontend/src/electricity/ElectricityBoardNode.tsx et frontend/src/electricity/mount-electricity.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implémenter le socle technique commun bloquant pour toutes les user stories.

**⚠️ CRITICAL**: No user story work starts before this phase is complete.

- [X] T006 Définir les enums/métadonnées partagées (supply type, phase, kind, actions) dans electricity/models.py
- [X] T007 Implémenter les modèles cœur (ElectricityBoard, ResidualCurrentDevice, Breaker, ElectricCircuit, UsagePoint, CircuitUsagePointLink, PlanChangeLog) dans electricity/models.py
- [X] T008 Générer la migration initiale dans electricity/migrations/0001_initial.py
- [X] T009 [P] Implémenter la permission owner-write/member-read dans electricity/permissions.py
- [X] T010 [P] Implémenter le scoping household et helpers de résolution des accès dans electricity/views.py
- [X] T011 [P] Mettre en place les serializers de base et validations transverses (household, refs, phase) dans electricity/serializers.py
- [X] T012 Enregistrer les modèles en admin avec affichages de base dans electricity/admin.py

**Checkpoint**: Foundation ready - user story implementation can begin.

---

## Phase 3: User Story 1 - Cartographier le tableau électrique (Priority: P1) 🎯 MVP

**Goal**: Permettre au owner de créer le plan électrique (tableau, protections, circuits, points d’usage) avec contraintes métier.

**Independent Test**: Créer un tableau + protections + circuits + points d’usage + liens actifs et vérifier la persistance et l’affichage SSR.

### Tests for User Story 1

- [X] T013 [P] [US1] Ajouter les tests API de création owner-only dans electricity/tests/test_api_us1_creation.py
- [X] T014 [P] [US1] Ajouter les tests de contraintes modèle (unicité repères, breaker unique par circuit, phase triphasé) dans electricity/tests/test_models_us1_constraints.py

### Implementation for User Story 1

- [X] T015 [P] [US1] Implémenter les serializers CRUD de board/rcd/breaker/circuit/usage-point dans electricity/serializers.py
- [X] T016 [US1] Implémenter les ViewSets CRUD DRF pour /boards, /rcds, /breakers, /circuits, /usage-points dans electricity/views.py
- [X] T017 [US1] Brancher le router API des endpoints US1 dans electricity/urls.py
- [X] T018 [US1] Ajouter la journalisation minimale des changements create/update dans electricity/models.py
- [X] T019 [US1] Implémenter la vue Django `app_electricity_view` avec contexte serveur (`electricity_page_props`, `server_sections`) dans electricity/views.py
- [X] T020 [US1] Construire le rendu SSR template-first (sections circuits/breakers/rcds/usage_points) dans templates/app/electricity.html
- [X] T021 [US1] Ajouter le test de rendu template et présence des clés de contexte dans electricity/tests/test_template_us1_context.py

**Checkpoint**: US1 is fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Naviguer dans les correspondances (Priority: P2)

**Goal**: Permettre la recherche bidirectionnelle disjoncteur↔points d’usage pour tous les membres en lecture.

**Independent Test**: Depuis des données US1, rechercher par repère disjoncteur puis par repère point d’usage et vérifier les correspondances retournées.

### Tests for User Story 2

- [X] T022 [P] [US2] Ajouter les tests API de lookup bidirectionnel dans electricity/tests/test_api_us2_lookup.py
- [X] T023 [P] [US2] Ajouter les tests permission lecture membre / écriture interdite membre dans electricity/tests/test_api_us2_permissions.py

### Implementation for User Story 2

- [X] T024 [US2] Implémenter l’endpoint `/api/electricity/mapping/lookup/` dans electricity/views.py
- [X] T025 [US2] Implémenter les filtres de navigation (breaker, phase, kind, is_active) sur endpoints list dans electricity/views.py
- [X] T026 [P] [US2] Implémenter le nœud React de mapping interactif dans frontend/src/electricity/ElectricityBoardNode.tsx
- [X] T027 [US2] Implémenter le montage du nœud React avec props JSON serveur dans frontend/src/electricity/mount-electricity.tsx et templates/app/electricity.html
- [X] T028 [US2] Alimenter `initialLookup` et `summary` côté vue serveur pour la consultation interactive dans electricity/views.py

**Checkpoint**: US2 works independently with bidirectional lookup and read-only member flow.

---

## Phase 5: User Story 3 - Maintenir le plan à jour (Priority: P3)

**Goal**: Permettre au owner de maintenir le plan avec soft delete, prévention des conflits et historique.

**Independent Test**: Désactiver un lien circuit↔point d’usage, réassigner le point, vérifier conflit évité et historique mis à jour.

### Tests for User Story 3

- [X] T029 [P] [US3] Ajouter les tests de soft delete des associations (deactivate endpoint + marquage auteur/date) dans electricity/tests/test_api_us3_soft_delete.py
- [X] T030 [P] [US3] Ajouter les tests de conflits de suppression (dépendances actives -> refus) dans electricity/tests/test_api_us3_conflicts.py

### Implementation for User Story 3

- [X] T031 [US3] Implémenter l’action `/api/electricity/links/{id}/deactivate/` (soft delete) dans electricity/views.py et electricity/serializers.py
- [X] T032 [US3] Implémenter la validation "un seul lien actif par usage point" et le workflow de réaffectation dans electricity/serializers.py
- [X] T033 [US3] Implémenter les gardes de suppression avec réponse conflit sur entités liées dans electricity/views.py
- [X] T034 [US3] Étendre le rendu SSR avec liens inactifs + changements récents dans electricity/views.py et templates/app/electricity.html
- [X] T035 [US3] Ajouter filtres/list display admin pour liens actifs/inactifs et logs dans electricity/admin.py

**Checkpoint**: US3 is independently functional with safe maintenance and historical traceability.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finitions transverses et validation quickstart.

- [X] T036 [P] Mettre à jour la documentation d’intégration (route mini-app + usage template-first + nœud React) dans README.md et AGENTS.md
- [X] T037 [P] Renforcer la validation sécurité cross-household sur toutes écritures serializer dans electricity/serializers.py
- [X] T038 Exécuter et documenter le scénario quickstart de bout en bout dans specs/001-electricity-circuit-module/quickstart.md
- [X] T039 [P] Mesurer SC-001 (création plan initial en <15 min) via scénario chronométré documenté dans specs/001-electricity-circuit-module/quickstart.md
- [X] T040 [P] Mesurer SC-002 (lookup bidirectionnel <10s) via test d’intégration dédié dans electricity/tests/test_metrics_sc2_lookup_time.py
- [X] T041 [P] Vérifier SC-003 (accès hors foyer bloqué à 100%) via tests permissions multi-households dans electricity/tests/test_metrics_sc3_access_control.py
- [X] T042 [P] Vérifier SC-004 (cohérence des modifications >=90%) via suite de règles de cohérence dans electricity/tests/test_metrics_sc4_consistency.py

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all user stories
- **Phase 3+ (User Stories)**: depend on Phase 2
- **Phase 6 (Polish)**: depends on all completed stories

### User Story Dependencies

- **US1 (P1)**: starts after Foundational, no dependency on US2/US3
- **US2 (P2)**: starts after Foundational, depends on US1 data shape but remains independently testable
- **US3 (P3)**: starts after Foundational, can reuse US1 entities and remains independently testable

### Within Each User Story

- Tests first (when present), then serializers/models rules, then endpoints/views, then template/React integration.

---

## Parallel Opportunities

- Setup: T003, T004, T005 can run in parallel after T001/T002.
- Foundational: T009, T010, T011 can run in parallel.
- US1: T013/T014 in parallel; T015 can run parallel to T019 after foundational.
- US2: T022/T023 in parallel; T026 can run parallel to T024/T025.
- US3: T029/T030 in parallel; T034 can run parallel to T035 after T031/T033.
- Polish: T036, T037, T039, T040, T041, T042 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests en parallèle
T013 [US1] electricity/tests/test_api_us1_creation.py
T014 [US1] electricity/tests/test_models_us1_constraints.py

# Implémentations en parallèle (après fondations)
T015 [US1] electricity/serializers.py
T019 [US1] electricity/views.py
```

## Parallel Example: User Story 2

```bash
# Implémentations parallèles
T024 [US2] electricity/views.py
T026 [US2] frontend/src/electricity/ElectricityBoardNode.tsx
```

## Parallel Example: User Story 3

```bash
# Tests en parallèle
T029 [US3] electricity/tests/test_api_us3_soft_delete.py
T030 [US3] electricity/tests/test_api_us3_conflicts.py
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational)
3. Complete Phase 3 (US1)
4. Validate independently via US1 tests and manual quick scenario

### Incremental Delivery

1. Ship US1 (cartographie complète owner)
2. Add US2 (navigation bidirectionnelle membre)
3. Add US3 (maintenance sécurisée + soft delete)
4. Finalize with Phase 6 polish and quickstart validation

### Team Parallelization

- Dev A: backend models/serializers/viewsets
- Dev B: template SSR + view context
- Dev C: React node ciblé + frontend mount
- Sync points: end of each story checkpoint
