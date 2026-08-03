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

## Jetons d'appareil (`DeviceToken`)

Envoyer une photo depuis un téléphone suppose un secret sur ce téléphone. Sans
jeton, le seul secret disponible est **le mot de passe du compte**, en clair, dans
un raccourci iOS qui se partage d'un geste et s'affiche dès qu'on montre son écran.
Un jeton d'appareil ne vaut que ce qu'il permet, et se révoque sans toucher au
compte.

- **Le secret n'est jamais stocké** : seule son empreinte SHA-256 l'est, et le clair
  n'est rendu **qu'une fois**, à la création (`DeviceToken.issue`). Un jeton qu'on
  peut relire en base a exactement la valeur d'un mot de passe, donc n'a plus de
  raison d'exister. SHA-256 suffit ici — contrairement à un mot de passe, le secret
  est déjà à haute entropie, les attaques par dictionnaire n'ont pas de prise.
- **Schéma d'en-tête distinct du JWT** : `Authorization: Device <secret>`. Deux
  mécanismes qui portent des droits différents ne doivent pas se ressembler à la
  lecture.
- **Révoquer coupe à la requête suivante**, pas au prochain déploiement.
- `POST /api/accounts/devices/` (créer, renvoie le secret) · `GET` (lister, **sans**
  secret) · `POST /api/accounts/devices/{id}/revoke/` (idempotent).

### ⚠️ Deux pièges, tous deux tenus par des tests

**1. `ActiveHouseholdMiddleware` tourne AVANT l'authentification DRF.** Une classe
d'authentification seule authentifierait l'utilisateur au niveau de la vue, mais le
middleware aurait déjà posé `request.household = None` — et tout envoi répondrait
« A valid household context is required », sans que rien ne désigne le middleware.
La résolution se pose donc **aux deux endroits**, et le format de l'en-tête n'a
qu'une définition (`accounts.authentication.raw_token_from_request`), lue par les
deux. Régression :
`accounts/tests/test_device_tokens.py::TestTheTokenResolvesTheHousehold`.

**2. La portée ne pouvait pas être une permission DRF.**
`DEFAULT_PERMISSION_CLASSES` est **remplacé**, pas complété, dès qu'une vue déclare
son propre `permission_classes` — ce que fait `DocumentViewSet` et la quasi-totalité
des viewsets. Un refus par défaut posé là n'aurait protégé que les vues qui n'ont
rien déclaré, soit l'inverse du but. D'où `core.middleware.DeviceTokenScopeMiddleware`
et son `process_view`, qui s'exécute après la résolution d'URL, voit la classe, et
que rien ne contourne.

### Le refus est le défaut

Une vue n'accepte un jeton qu'en le déclarant :

```python
class DocumentViewSet(...):
    allows_device_token = ('upload',)   # ou True pour toute la vue
```

C'est la règle de `core/views_media.py` (« ce qui n'est pas explicitement autorisé
est refusé ») portée à l'authentification. Un jeton qui vaudrait pour toute l'API
lirait le journal du foyer, les comptes bancaires et les documents privés depuis un
raccourci recopié sur un téléphone. Conséquence voulue : **la vue de gestion des
jetons ne se déclare pas** — un appareil volé ne peut ni s'en émettre un autre, ni
révoquer celui qui le gêne.

**Ce qui revient est borné aussi.** La réponse de `POST /documents/upload/` embarque
normalement `recent_interaction_candidates` — les cinq dernières entrées du journal
du foyer — pour que l'interface web propose d'y relier le document. Un appareil ne
les reçoit pas : « ne donner accès qu'à l'envoi » vaut pour la réponse autant que
pour la requête.
