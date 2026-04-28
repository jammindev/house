# Module — zones

> Audit : 2026-04-28. Rôle : organisation spatiale hiérarchique (pièces, étages, bâtiments) servant de contexte de navigation à toute l'app.

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet — `ui/src/features/zones/` (`ZonesPage`, `ZoneDetailPage`, `ZoneDialog`, `ZoneItem`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok — namespace `zones` présent dans les 4 fichiers de traduction
- **Tests** : oui — 3 fichiers dans `tests/` (`test_api_zones_extra.py`, `test_import_supabase_zones.py`, `test_import_supabase_zone_documents.py`) + `tests.py` legacy (73 lignes) à la racine
- **Migrations** : 5 (dont 2 nouvelles en P3 : `0004_root_zone_unique.py`, `0005_zone_one_root_constraint.py`)
- **Couverture parcours métier** : parcours 05 (navigation par zone)

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

- [ ] Supprimer une zone avec enfants : le backend renvoie un 409 sans message d'erreur lisible dans l'UI — *#71*

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Multi-select de zones sur les formulaires (la majorité des objets sont en M2M avec `Zone`) avec propagation de la zone parente du contexte — *source : inspection code, non couvert en P3*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Uniformiser la structure des tests : `tests.py` legacy à supprimer, tout regrouper dans `tests/` avec `test_models.py`/`test_views.py`/`factories.py` — *#44*
- [ ] `Zone.depth` est récursif et fait une requête par niveau (`apps/zones/models.py:86-91`) — envisager de cacher ou d'utiliser une CTE pour les arbres profonds
- [ ] `unique_together = [['id', 'household']]` sur Zone (`apps/zones/models.py:54`) — redondant avec PK UUID, à clarifier ou retirer

## Notes / décisions produit

- **P3 (commit e540d6f)** : zone racine unique par household, créée automatiquement au signal `post_save(Household)`. `Zone.save()` auto-attache les nouvelles zones à cette racine si aucun parent fourni. `TaskViewSet.perform_create()` utilise aussi cette racine comme fallback côté API. Contrainte DB : `UniqueConstraint` partiel sur `(household, parent IS NULL)`. Données legacy (ex. seed Mercier : 10 racines) normalisées par data-migration avant application de la contrainte.
- **Frontend P3** : `findRootZone()` helper dans `ui/src/lib/api/zones`; pré-sélection de la racine dans `NewTaskDialog`, `BoardDialog`, `UsagePointDialog`, `InteractionNewPage`.
- `Zone` hérite de `HouseholdScopedModel` (`apps/core/models.py`) → audit timestamps + `household` FK obligatoire au save.
- Validation custom dans `Zone.save` : un parent doit appartenir au même household, sinon `ValueError` (`apps/zones/models.py:73-77`).
- Suppression bloquée si la zone a des enfants (409) — pas de cascade UI offerte ; voir `apps/zones/views.py:82-90`.
- L'endpoint `tree` exige un `household_id` query param (`apps/zones/views.py:97-103`) ; `IsHouseholdMember` vérifie alors la membership via header/query/body.
- `Zone.color` est validé deux fois : `RegexValidator` au niveau du champ + `CheckConstraint` DB (`zones_color_hex_check`).
- `ZoneDocument.role` actuellement toujours `'photo'` — extensible à d'autres rôles si besoin.
