# Module — zones

> Audit : 2026-04-27. Rôle : organisation spatiale hiérarchique (pièces, étages, bâtiments) servant de contexte de navigation à toute l'app.

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet — `ui/src/features/zones/` (`ZonesPage`, `ZoneDetailPage`, `ZoneDialog`, `ZoneItem`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok — namespace `zones` présent dans les 4 fichiers de traduction (`ui/src/locales/{en,fr,de,es}/translation.json` ligne 337)
- **Tests** : oui — 3 fichiers dans `tests/` (`test_api_zones_extra.py`, `test_import_supabase_zones.py`, `test_import_supabase_zone_documents.py`) + `tests.py` legacy (73 lignes) à la racine
- **Migrations** : 3

## Modèles & API

- Modèles principaux : `Zone` (HouseholdScopedModel, parent self-FK pour hiérarchie, `color` hex validé, `surface` Decimal optionnelle, `note`), `ZoneDocument` (M2M zone↔document avec `role='photo'`) — `apps/zones/models.py`
- Endpoints exposés sous `/api/zones/` :
  - `GET|POST /`, `GET|PATCH|DELETE /{id}/` (DELETE refuse si `children.exists()` → 409)
  - `GET /tree/?household_id=<id>` — racines + enfants imbriqués via `ZoneTreeSerializer`
  - `GET /{id}/children/`, `GET /{id}/photos/`, `POST /{id}/attach_photo/`
  - Optimistic concurrency : champ `last_known_updated_at` accepté en update → 409 si stale
- Permissions : `IsAuthenticated, IsHouseholdMember` (`apps/zones/views.py:28`) ; pas de permission custom propre au module
- Commands de gestion : `import_supabase_zones`, `import_supabase_zone_documents` (migration depuis l'ancienne stack)

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

- [ ] À la création d'un household, créer une zone ancêtre unique (le foyer) ; interdire les zones frère/soeur au niveau racine — *source : `URGENT.md` ligne 2*
- [ ] Mécanisme général d'auto-attachement à la zone ancêtre si aucune zone fournie côté backend (ou erreur explicite) — *source : `URGENT.md` ligne 2*
- [ ] Multi-select de zones sur les formulaires (la majorité des objets sont en M2M avec `Zone`) avec propagation de la zone parente du contexte — *source : `URGENT.md` ligne 2*

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Composant input zone généraliste réutilisable qui pré-sélectionne la zone parente quand un objet vient d'un contexte zoné — *source : `URGENT.md` ligne 2*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Uniformiser la structure des tests : `tests.py` legacy à supprimer, tout regrouper dans `tests/` avec `test_models.py`/`test_views.py`/`factories.py` — *source : `GITHUB_ISSUES_BACKLOG.md` REFACTOR-04 / `docs/ARCHITECTURE_AUDIT_2026_03.md` lignes 79-90*
- [ ] `Zone.depth` est récursif et fait une requête par niveau (`apps/zones/models.py:86-91`) — envisager de cacher ou d'utiliser une CTE pour les arbres profonds
- [ ] `unique_together = [['id', 'household']]` sur Zone (`apps/zones/models.py:54`) — redondant avec PK UUID, à clarifier ou retirer

## Notes

- `Zone` hérite de `HouseholdScopedModel` (`apps/core/models.py`) → audit timestamps + `household` FK obligatoire au save.
- Validation custom dans `Zone.save` : un parent doit appartenir au même household, sinon `ValueError` (`apps/zones/models.py:73-77`).
- Suppression bloquée si la zone a des enfants (409) — pas de cascade UI offerte ; voir `apps/zones/views.py:82-90`.
- L'endpoint `tree` exige un `household_id` query param (`apps/zones/views.py:97-103`) ; `IsHouseholdMember` vérifie alors la membership via header/query/body.
- `Zone.color` est validé deux fois : `RegexValidator` au niveau du champ + `CheckConstraint` DB (`zones_color_hex_check`).
- `ZoneDocument.role` actuellement toujours `'photo'` — extensible à d'autres rôles si besoin.
