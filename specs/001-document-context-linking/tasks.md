# Tasks: Traiter un document entrant et le relier au bon contexte

**Input**: Design documents from `/specs/001-document-context-linking/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Inclure des tests API et web ciblés, car la spec et le quickstart demandent explicitement une mise à jour des tests essentiels.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. [US1], [US2], [US3])
- Every task includes exact file paths in the description

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Préparer les points d’entrée et le socle i18n des nouvelles pages documents

- [X] T001 Add document page Vite entry points in ui/vite.config.ts
- [X] T002 [P] Create document page mount files in ui/src/pages/documents/new.tsx and ui/src/pages/documents/detail.tsx
- [X] T003 [P] Scaffold the `documents` translation namespace for new flows in ui/src/locales/en/translation.json, ui/src/locales/fr/translation.json, ui/src/locales/de/translation.json, and ui/src/locales/es/translation.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Mettre en place les contrats et la plomberie partagée avant les user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define shared Django web route skeletons for documents list/create/detail in apps/documents/views_web.py and apps/documents/web_urls.py
- [X] T005 [P] Regenerate and adopt contract-aligned document and interaction API client types after contract changes in ui/src/gen/api/, ui/src/lib/api/documents.ts, and ui/src/lib/api/interactions.ts
- [X] T006 [P] Add contract-aligned document qualification and context summary serializers in apps/documents/serializers.py
- [X] T007 Implement shared document queryset/detail enrichment for qualification state and context summaries in apps/documents/views.py
- [X] T008 [P] Add translated Django page titles and shell labels for document list/create/detail in apps/documents/views_web.py, locale/en/LC_MESSAGES/django.po, locale/fr/LC_MESSAGES/django.po, locale/de/LC_MESSAGES/django.po, and locale/es/LC_MESSAGES/django.po
- [X] T009 Add a baseline bundle-budget check for document page entries in package.json and ui/vite.config.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Ajouter et repérer un document à traiter (Priority: P1) 🎯 MVP

**Goal**: Permettre l’upload réel d’un document, la redirection immédiate vers son détail, puis sa retrouvabilité claire dans la liste des documents à traiter

**Independent Test**: Depuis `/app/documents/`, l’utilisateur ajoute un fichier depuis `/app/documents/new/`, est redirigé vers le détail du document créé, puis retrouve ce document dans la liste avec l’état `sans contexte`

### Tests for User Story 1

- [X] T010 [P] [US1] Add API tests for multipart upload, household resolution, and list qualification flags in apps/documents/tests/test_api_documents.py
- [X] T011 [P] [US1] Add web route, SSR, and permission-denial tests for document list/create pages in apps/documents/tests/test_web_documents.py

### Implementation for User Story 1

- [X] T012 [US1] Implement the multipart document upload endpoint and upload serializer flow in apps/documents/views.py and apps/documents/serializers.py
- [X] T013 [US1] Add upload path sanitization, media write rules, and delete-safe file handling in apps/documents/views.py and apps/documents/models.py
- [X] T014 [US1] Build the document create page component for file selection, name prefill, and submit states in apps/documents/react/DocumentCreatePage.tsx
- [X] T015 [US1] Wire the document create page SSR props and routes in apps/documents/views_web.py, apps/documents/web_urls.py, and ui/src/pages/documents/new.tsx
- [X] T016 [US1] Update the documents list to use SSR initial data, show the add-document CTA, and filter by `without_activity` in apps/documents/react/DocumentsPage.tsx, apps/documents/react/DocumentsFilters.tsx, apps/documents/react/DocumentListItem.tsx, and ui/src/lib/api/documents.ts

**Checkpoint**: User Story 1 should be functional as an MVP

---

## Phase 4: User Story 2 - Comprendre l'état d'un document (Priority: P2)

**Goal**: Afficher une page détail document claire avec identité, OCR, contexte actuel et actions principales

**Independent Test**: Depuis la liste, l’utilisateur ouvre un document et voit immédiatement ses métadonnées principales, son état de qualification, ses activités liées et ses contextes secondaires visibles

### Tests for User Story 2

- [X] T017 [P] [US2] Add API tests for the enriched document detail payload in apps/documents/tests/test_api_documents.py
- [X] T018 [P] [US2] Add web route, SSR, and inaccessible-document permission tests for the document detail page in apps/documents/tests/test_web_documents.py

### Implementation for User Story 2

- [X] T019 [US2] Expose enriched detail fields for linked interactions, qualification state, and secondary context summaries in apps/documents/serializers.py and apps/documents/views.py
- [X] T020 [US2] Build the document detail page component with identity, OCR, context, and action sections in apps/documents/react/DocumentDetailPage.tsx
- [X] T021 [US2] Add the document detail route, SSR props, and mount wiring in apps/documents/views_web.py, apps/documents/web_urls.py, and ui/src/pages/documents/detail.tsx
- [X] T022 [US2] Update document list navigation and detail refresh helpers in apps/documents/react/DocumentListItem.tsx and ui/src/lib/api/documents.ts

**Checkpoint**: User Stories 1 and 2 should both work, with stable list → detail navigation

---

## Phase 5: User Story 3 - Relier un document à une activité existante (Priority: P3)

**Goal**: Permettre le rattachement d’un document à une activité existante avec validation household et refus propre des doublons exacts

**Independent Test**: Depuis le détail document, l’utilisateur choisit une activité récente ou trouvée par recherche simple, crée le lien, voit le contexte mis à jour, puis obtient un refus explicite s’il recommence le même rattachement

### Tests for User Story 3

- [X] T023 [P] [US3] Add API tests for interaction-document linking, household validation, and duplicate refusal in apps/interactions/tests/test_api_interactions.py
- [X] T024 [P] [US3] Add document detail tests covering recent interaction candidates and post-link refresh in apps/documents/tests/test_web_documents.py

### Implementation for User Story 3

- [X] T025 [US3] Implement document household validation and duplicate-conflict responses for interaction-document creation in apps/interactions/views.py and apps/interactions/serializers.py
- [X] T026 [US3] Add recent interaction candidate payloads and simple interaction search helpers in apps/documents/views.py and ui/src/lib/api/interactions.ts
- [X] T027 [US3] Implement the attach-to-existing-activity UI on document detail in apps/documents/react/DocumentDetailPage.tsx
- [X] T028 [US3] Refresh qualification state and linked activities after attach actions in apps/documents/react/DocumentDetailPage.tsx and ui/src/lib/api/documents.ts

**Checkpoint**: User Stories 1 to 3 should work together, including duplicate-safe linking

---

## Phase 6: User Story 4 - Créer une activité depuis un document (Priority: P4)

**Goal**: Réutiliser le flux de création d’activité existant pour créer une activité liée au document de manière atomique et revenir au détail document

**Independent Test**: Depuis le détail document, l’utilisateur lance la création d’activité, complète le formulaire existant avec au moins une zone, crée l’activité, puis revient au détail document avec le nouveau lien visible

### Tests for User Story 4

- [X] T029 [P] [US4] Add API tests for interaction creation with `document_ids` in apps/interactions/tests/test_api_interactions.py
- [X] T030 [P] [US4] Add web flow tests for source-document handoff, success redirect, and inaccessible source-document rejection in apps/documents/tests/test_web_documents.py and apps/interactions/tests/test_web_interactions.py

### Implementation for User Story 4

- [X] T031 [US4] Extend the interaction creation contract to accept `document_ids` and create links atomically in apps/interactions/serializers.py and apps/interactions/views.py
- [X] T032 [US4] Resolve `source_document_id` and success redirect props for the existing interaction create page in apps/interactions/views_web.py
- [X] T033 [US4] Update the interaction create helper and form to submit `document_ids` and redirect back to the source document in ui/src/lib/api/interactions.ts and apps/interactions/react/InteractionCreateForm.tsx
- [X] T034 [US4] Add the create-activity CTA and handoff wiring on the document detail page in apps/documents/react/DocumentDetailPage.tsx and apps/documents/views_web.py

**Checkpoint**: All four user stories should now be functionally complete

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finaliser la cohérence transverse, l’i18n et la validation du parcours complet

- [X] T035 [P] Complete all new React translations for documents and interaction handoff in ui/src/locales/en/translation.json, ui/src/locales/fr/translation.json, ui/src/locales/de/translation.json, and ui/src/locales/es/translation.json
- [X] T036 [P] Complete Django translation catalog updates for document and interaction page shell strings in locale/en/LC_MESSAGES/django.po, locale/fr/LC_MESSAGES/django.po, locale/de/LC_MESSAGES/django.po, and locale/es/LC_MESSAGES/django.po
- [X] T037 Validate implementation against SC-001 to SC-006, the end-to-end quickstart, and the approved contracts in specs/001-document-context-linking/spec.md, specs/001-document-context-linking/quickstart.md, specs/001-document-context-linking/contracts/document-context-api.yaml, and specs/001-document-context-linking/contracts/documents-web-contract.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion and reuses the document routes scaffolded earlier
- **User Story 3 (Phase 5)**: Depends on Foundational completion and builds on the document detail screen from US2
- **User Story 4 (Phase 6)**: Depends on Foundational completion and reuses the document detail and interaction create flows from US2/US3
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories after Foundational; this is the MVP
- **US2 (P2)**: Can use the output of US1 but remains independently testable once a document exists
- **US3 (P3)**: Uses the document detail surface from US2 to expose linking actions
- **US4 (P4)**: Uses the document detail surface from US2 and the link semantics from US3 for a coherent return flow

### Within Each User Story

- Tests should be written before implementation and fail first
- Backend contract and validation before UI mutation flows
- SSR props and mount wiring before page-level runtime behaviors
- Story-specific UI refresh and navigation handling after core backend behavior is in place

### Parallel Opportunities

- T002 and T003 can run in parallel
- T005, T006, and T008 can run in parallel once T004 starts the shared route skeleton
- T010 and T011 can run in parallel for US1
- T017 and T018 can run in parallel for US2
- T023 and T024 can run in parallel for US3
- T029 and T030 can run in parallel for US4
- T035 and T036 can run in parallel in the Polish phase

---

## Parallel Example: User Story 1

- Launch T010 and T011 together to cover API and web regression tests for upload/list behavior
- Launch T014 and T015 separately once T012 defines the backend upload contract, because the component file and route wiring are distinct files

---

## Parallel Example: User Story 2

- Launch T017 and T018 together for API and SSR coverage of the detail page
- Launch T020 and T021 in sequence after T019 exposes the detail payload shape

---

## Parallel Example: User Story 3

- Launch T023 and T024 together to define link behavior and UI refresh expectations
- Launch T025 and T026 in parallel after tests are in place, because backend duplicate validation and frontend search helpers live in different files

---

## Parallel Example: User Story 4

- Launch T029 and T030 together to define API and handoff expectations
- Launch T032 and T033 in parallel after T031 establishes the atomic `document_ids` contract

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the upload → detail → list loop from quickstart
5. Demo/deploy the MVP if stable

### Incremental Delivery

1. Finish Setup + Foundational once
2. Deliver US1 for the first usable document flow
3. Add US2 for a real detail page and context visibility
4. Add US3 for qualification by linking to an existing activity
5. Add US4 for full create-from-document continuity
6. Finish with Phase 7 polish and end-to-end validation

### Parallel Team Strategy

With multiple developers after Phase 2:

1. Developer A: US1 upload/list flow
2. Developer B: US2 detail page
3. Developer C: Prepare US3/US4 tests and interaction API extensions
4. Merge story by story, validating each independent checkpoint before moving on

---

## Notes

- [P] tasks target different files and no incomplete dependency
- [US1] remains the recommended MVP slice
- Keep `InteractionDocument` as product truth and `Document.interaction` as compatibility only
- Preserve Django-routed pages and avoid introducing a client-side documents router
- Re-run quickstart validation before closing the feature
