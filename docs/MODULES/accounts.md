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

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

- [ ] Page d'inscription absente — aucune `SignupPage` dans `ui/src/features/auth/` — *source : #59*
- [ ] Validation du mot de passe à l'inscription insuffisante (aucun validateur Django dans le serializer) — *source : #60*
- [ ] Messages d'erreur login hardcodés (voir aussi auth-frontend) — *source : #61*
- [ ] Réinitialisation de mot de passe non implémentée (ni backend ni frontend) — *source : #62*
- [ ] Changement d'email non implémenté (aucun endpoint `change_email` dans `apps/accounts/views/api.py`) — *source : #70*

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Migration JWT `localStorage` → cookies `httpOnly; Secure; SameSite=Strict` (impersonation context côté serveur) — *source : #47, `docs/SECURITY_REVIEW.md` lignes 25-42*
- [ ] Audit log des actions sensibles (changement password, impersonation, suppressions) via middleware ou signals — *source : #48, `docs/SECURITY_REVIEW.md` lignes 139-142*
- [ ] 2FA / TOTP optionnel via `django-otp`, obligatoire pour staff/admin et avant impersonation — *source : #49, `docs/SECURITY_REVIEW.md` lignes 146-149*
- [ ] Notification email à l'utilisateur cible lors d'une impersonation, tracking des sessions actives — *source : `docs/SECURITY_REVIEW.md` ligne 57*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Throttle sur l'inscription et la liste users (déféré dans la security review) — *source : `docs/SECURITY_REVIEW.md` ligne 112*
- [ ] Vérifier `SESSION_COOKIE_HTTPONLY/SECURE/SAMESITE='Strict'` en production — *source : `docs/SECURITY_REVIEW.md` ligne 155*
- [ ] Ajouter validateurs serializer (`max_length`, URL, `ChoiceField` pour les enums theme/color_theme) — *source : `docs/SECURITY_REVIEW.md` ligne 157*
- [ ] Migrer `ProtectedLayout.tsx` pour utiliser `useCurrentUser` au lieu du hook déprecié `useMe` — *source : `ui/src/components/ProtectedLayout.tsx:10`, `ui/src/features/settings/hooks.ts:48-49`*

## Notes

- `User.locale` peut être `null` → fallback navigateur via `UserLocaleMiddleware` (`apps/core/middleware.py`).
- `is_active` est `read_only` côté serializer pour empêcher le mass assignment (`apps/accounts/serializers.py:29`).
- Les non-staff ne voient que leur propre user via `GET /api/accounts/users/` (`apps/accounts/views/api.py:76-83`).
- Impersonation : produit un JWT court via `accounts.tokens.get_impersonation_token`, log écrit dans `logger.info` (`apps/accounts/views/api.py:168`).
- Endpoint `me_view` est un `@api_view` séparé du `UserViewSet.me` — deux chemins légèrement différents pour la même intention.
- Thème (light/dark) persisté en `localStorage` (`theme`, `color_theme`) séparément des tokens JWT — le `logout()` ne supprime pas ces clés donc le thème est bien préservé après déconnexion (`ui/src/lib/auth/context.tsx:74-81`).
- Anti-blink du thème au chargement : script inline dans `templates/index.html` lit `localStorage.theme` avant le mount React — pas de flash.
