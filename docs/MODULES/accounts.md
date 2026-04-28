# Module — accounts

> Audit : 2026-04-28. Rôle : authentification, profil utilisateur, gestion des comptes et impersonation admin.

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet — `ui/src/features/auth/LoginPage.tsx`, `ui/src/features/admin/AdminUsersPage.tsx`, sections profil dans `ui/src/features/settings/`
- **Locales (en/fr/de/es)** : ok — namespaces `auth`, `settings`, `admin` présents dans les 4 locales
- **Tests** : oui — 5 fichiers (`test_api.py`, `test_jwt.py`, `test_models.py`, `test_views.py`, `conftest.py`)
- **Migrations** : 9

## Modèles & API

- Modèles principaux : `User` (custom AbstractBaseUser + PermissionsMixin, email = USERNAME_FIELD, FK `active_household`, theme, color_theme, locale, avatar) — `apps/accounts/models.py`
- Endpoints exposés sous `/api/accounts/` :
  - `GET /me/` — endpoint léger pour SPA auth context
  - `POST /auth/login/`, `POST /auth/logout/` — session-based
  - `GET|PATCH /users/me/`, `POST /users/me/change-password/`, `POST|DELETE /users/me/avatar/`
  - `GET /users/`, `POST /users/` (registration AllowAny), `POST /users/{id}/impersonate/` (staff only)
- Permissions : `IsAuthenticated` par défaut ; `AllowAny` pour `login` et `create` ; `IsAdminUser` pour `impersonate` ; throttles `LoginIPRateThrottle`, `LoginEmailRateThrottle`, `ChangePasswordRateThrottle`

## Notes

- `User.locale` peut être `null` → fallback navigateur via `UserLocaleMiddleware` (`apps/core/middleware.py`).
- `is_active` est `read_only` côté serializer pour empêcher le mass assignment (`apps/accounts/serializers.py:29`).
- Les non-staff ne voient que leur propre user via `GET /api/accounts/users/` (`apps/accounts/views/api.py:76-83`).
- Impersonation : produit un JWT court via `accounts.tokens.get_impersonation_token`, log écrit dans `logger.info` (`apps/accounts/views/api.py:168`).
- Endpoint `me_view` est un `@api_view` séparé du `UserViewSet.me` — deux chemins légèrement différents pour la même intention.
- Thème (light/dark) persisté en `localStorage` (`theme`, `color_theme`) séparément des tokens JWT — le `logout()` ne supprime pas ces clés donc le thème est bien préservé après déconnexion (`ui/src/lib/auth/context.tsx:74-81`).
- Anti-blink du thème au chargement : script inline dans `templates/index.html` lit `localStorage.theme` avant le mount React — pas de flash.
