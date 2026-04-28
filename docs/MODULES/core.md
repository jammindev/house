# Module — core

> Audit : 2026-04-28. Rôle : app transverse fournissant modèles abstraits, permissions, middleware, validation et serving média protégé aux autres apps.

## État synthétique

- **Backend** : Présent (transverse, pas d'API métier)
- **Frontend** : Absent (par design — fournit du code Python aux autres apps)
- **Locales (en/fr/de/es)** : non applicable (pas d'UI directe)
- **Tests** : oui — 3 fichiers (`tests/test_file_validation.py`, `tests/test_views_media.py`, `tests.py` à la racine 278 lignes)
- **Migrations** : 2 (initial + suppression `SystemAdmin`)

## Modèles & API

- Modèles abstraits fournis : `TimestampedModel` (`created_at`, `updated_at`, `created_by`, `updated_by`) et `HouseholdScopedModel` (TimestampedModel + FK `household`) — `apps/core/models.py`
- Manager : `HouseholdScopedManager` / `HouseholdScopedQuerySet` avec `.for_household(id)` et `.for_user_households(user)` — `apps/core/managers.py`
- Permissions : `IsHouseholdMember`, `IsHouseholdOwner`, `CanViewPrivateContent` + helpers `resolve_request_household`, `resolve_selected_household` (`apps/core/permissions.py`)
- Middleware : `UserLocaleMiddleware` (active `User.locale`), `ActiveHouseholdMiddleware` (expose `request.household`, supporte JWT/force_authenticate/session), `AcceptLanguageRedirectMiddleware` — `apps/core/middleware.py`
- Validation upload : `apps/core/file_validation.py` — détection magic bytes (JPEG, PNG, GIF, WebP, PDF), `validate_upload(file, allowed_types, max_size)`, constantes `ALLOWED_IMAGE_TYPES`, `DOCUMENT_MAX_SIZE` (20 MB), `AVATAR_MAX_SIZE` (2 MB)
- Vue média protégée : `serve_protected_media` (`apps/core/views_media.py`) — vérifie auth + membership household + privacy `is_private`, retourne `X-Accel-Redirect` en prod
- `urls.py` vide (pas d'endpoint exposé directement par core) — `apps/core/urls.py`
- Endpoints fournis indirectement : `serve_protected_media` est routé depuis `config/urls.py`

## Notes

- Multi-tenancy défensive à 4 niveaux (DB FK / ORM manager / middleware request.household / serializer base class) — `docs/ARCHITECTURE_AUDIT_2026_03.md` lignes 17-24.
- `HouseholdScopedModel.save` lève `ValueError` si `household_id` absent — *garde-fou strict* (`apps/core/models.py:52-56`).
- `ActiveHouseholdMiddleware` résout le user dans l'ordre : JWT Bearer → `_force_auth_user` (tests) → session (`apps/core/middleware.py:73-107`).
- `serve_protected_media` : en `DEBUG` Django serve directement le fichier ; en prod, X-Accel-Redirect vers `/_protected_media/` (Nginx `internal;`).
- Le module ne fournit pas de Page React — toute la couche frontend dépend implicitement des contrats exposés par core (e.g. `request.household`, le pattern `created_by`/`updated_by`).
- `apps/core/tests.py` couvre les permissions, `resolve_request_household`, `IsHouseholdMember/Owner`, `CanViewPrivateContent`. Un duplicata `tests/` existe pour file_validation et views_media.
