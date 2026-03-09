# Tasks: Migration Zones 1:1 Legacy vers Django

**Input**: Design documents from `/specs/003-migrate-zones-parity/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup

- [x] T001 Create mirrored React structure under `apps/zones/react/{components,hooks,lib,types}`
- [x] T002 Add dedicated adapter module `apps/zones/react/lib/zones-adapter.ts`
- [x] T003 Define shared legacy-like types in `apps/zones/react/types/zones.ts`

## Phase 2: Tests First (TDD)

- [x] T004 [P] Add serializer/view tests for delete-parent-with-children conflict in `apps/zones/tests.py`
- [x] T005 [P] Add serializer/view tests for stale-update conflict in `apps/zones/tests.py`
- [x] T006 [P] Add web view tests for zones list/detail initial payload in `apps/zones/tests.py`

## Phase 3: Core Implementation

- [x] T007 Implement adapter mapping DRF <-> legacy shapes in `apps/zones/react/lib/zones-adapter.ts`
- [x] T008 Implement `useZones` hook (initial state + CRUD + tree/children + optimistic conflict handling) in `apps/zones/react/hooks/useZones.ts`
- [x] T009 Implement list/tree components (`ZoneList`, `ZoneItem`, `ZoneForm`, `ZoneEditDialog`) in `apps/zones/react/components/`
- [x] T010 Replace minimal `ZonesNode.tsx` with legacy-like container composition
- [x] T011 Add detail hook `useZoneDetail` in `apps/zones/react/hooks/useZoneDetail.ts`
- [x] T012 Add detail components (`ZonePhotoGallery`, `GalleryPhoto`, `ZoneStats`) in `apps/zones/react/components/`
- [x] T013 Add detail page entrypoint in `apps/zones/react/mount-zone-detail.tsx`

## Phase 4: Integration

- [x] T014 Update Django web routing for zone detail in `apps/zones/web_urls.py` and `config/urls.py` wiring if needed
- [x] T015 Update web views to provide `zones_page_props` and `zone_detail_page_props` in `apps/zones/views_web.py`
- [x] T016 Update templates to mini-SPA pattern with json_script roots in `apps/zones/templates/zones/app/zones.html`
- [x] T017 Add dedicated detail template `apps/zones/templates/zones/app/zone_detail.html`
- [x] T018 Update API behavior for delete-parent conflict and stale-update conflict in `apps/zones/views.py`

## Phase 5: Polish

- [x] T019 [P] Ensure i18n strings are used for new user-facing messages in templates/backend responses
- [x] T020 [P] Remove obsolete simplified zones entry code if fully superseded
- [x] T021 Run targeted verification: `python manage.py migrate` then `pytest apps/zones -v`
- [ ] T022 Manual parity check list vs legacy for tree/CRUD/colors/detail/photos using `quickstart.md`

## Dependencies

- T001-T003 before T007-T013
- T004-T006 before T018
- T008 depends on T007
- T009 depends on T008
- T010 depends on T008-T009
- T011-T013 depend on T007
- T014-T017 depend on T010 and T011-T013
- T021 depends on T018-T020

## Parallel Example

- Phase 2 tests marked [P] can run in parallel
- Phase 5 T019 and T020 can run in parallel
