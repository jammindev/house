# AGENTS.md — Contexte projet (racine active)

Ce document donne le contexte rapide pour toute IA intervenant sur ce repo.

> Dernière mise à jour : avril 2026 (refonte SPA)

## 1) Scope

- **Code actif principal**: backend Django dans `apps/` + frontend React SPA dans `ui/`
- **Archive historique**: branche git `archive/legacy` (supprimée du `main`)
- **Règle**: la vérité runtime est dans `config/`, `apps/`, `ui/` ; les anciennes docs sont uniquement référence métier.

## 1.1) Statut du projet (important)

Le projet a basculé en **SPA pure**: backend Django/DRF expose une API REST, frontend React + react-router consomme l'API. Plus de templates Django par page (un seul template `index.html` catch-all sert la SPA).

Phase produit en cours : **parcours métier 06 — Alertes proactives** (parcours 01–05 livrés). Voir `docs/JOURNAL_PRODUIT.md` et `docs/parcours/`.

Pour l'IA :

- La vérité runtime est dans `config/`, `apps/` (backend) et `ui/src/` (frontend SPA).
- Pour l'état détaillé d'un module, lire `docs/MODULES/<app>.md`.

## 2) Stack

- Backend: Django 5.2, DRF 3.16, drf-simplejwt 5.5, drf-spectacular 0.29, django-filter
- DB: PostgreSQL (local/prod), SQLite in-memory (tests)
- Frontend: React 19, TypeScript 5.9, Vite 7, react-router 7, TanStack Query 5, Zustand 5
- Styling: Tailwind 4, Radix UI primitives, Lucide icons
- Auth: JWT (rest_framework_simplejwt) + session Django (fallback). JWT prioritaire.
- i18n: i18next, 4 locales (en, fr, de, es)

## 3) Apps Django (17 apps installées)

### Apps métier avec modèles + API DRF

- `accounts` : User custom (email login), auth JWT + session, throttles login/IP/email/change-password, impersonation admin
- `households` : Household + HouseholdMember (owner/member) + HouseholdInvitation, soft-delete via `archived_at`
- `zones` : hiérarchie spatiale auto-référencée (parent), couleur hex, surface
- `interactions` : journal (note, todo, expense, maintenance…) + liens M2M zones/contacts/structures/documents/projects/equipment, full-text via `enriched_text`
- `documents` : fichiers + OCR (à brancher) + privacy `is_private`, lien optionnel à interaction
- `directory` : Contact, Structure, Address, Email, Phone (annuaire household-scoped)
- `tags` : Tag + TagLink polymorphe (GenericForeignKey)
- `equipment` : équipements (warranty, maintenance, status), join `EquipmentInteraction`
- `stock` : `StockCategory` + `StockItem` (quantité, expiration, fournisseur)
- `electricity` : `ElectricityBoard`, `ProtectiveDevice`, `ElectricCircuit`, `UsagePoint`, `CircuitUsagePointLink`, `MaintenanceEvent`, `PlanChangeLog`
- `projects` : `ProjectGroup`, `Project` (status/type/priority/budget), joins `ProjectDocument`/`ProjectZone`, threads IA (`ProjectAIThread`/`ProjectAIMessage`)
- `insurance` : `InsuranceContract` (modèle + API uniquement, pas encore d'UI)
- `tasks` : `Task` (modèle dédié, plus dérivé d'interactions) + joins zones/documents/interactions, `assigned_to`, `completed_by`
- `notifications` : `Notification` user-scoped (pas household), soft-delete

### Apps frontend-only (pas de modèles propres)

- `photos` : namespace UI (les médias passent par `documents`)
- `app_settings` : namespace UI (paramètres user/household)

### App transverse

- `core` : modèles abstraits (`TimestampedModel`, `HouseholdScopedModel`), managers (`HouseholdScopedManager`), permissions (`IsHouseholdMember`, `IsHouseholdOwner`, `CanViewPrivateContent`), middleware `ActiveHouseholdMiddleware` + `UserLocaleMiddleware`

## 4) Conventions techniques importantes

- Modèle user custom : `AUTH_USER_MODEL = "accounts.User"` (login par email)
- Les modèles métier utilisent `HouseholdScopedModel` (champ `household` + manager scopé)
- Permissions multi-tenant via `IsHouseholdMember` (membre du household sélectionné)
- Auth : `JWTAuthentication` (prioritaire) + `SessionAuthentication` (fallback). Endpoints `/api/auth/token/` (obtain), `/api/auth/token/refresh/`, `/api/auth/token/verify/`.
- Résolution household côté API : header `X-Household-Id` → `household_id` (query/body) → `request.user.active_household` → auto-select si une seule membership. Implémentée dans `core.middleware.ActiveHouseholdMiddleware`.
- Rate limiting login : `accounts/throttles.py` — `LoginIPRateThrottle` (20/min par IP) + `LoginEmailRateThrottle` (5/min par email)
- Cache throttle : `LocMemCache` en dev. En prod multi-workers : brancher Redis (`django-redis`).
- Routes API : `config/urls.py` sous `api/<app>/` uniquement.
- **Plus de routes web côté Django** : un catch-all `re_path(r"^(?!api/|admin/|static/|media/|i18n/).*$", TemplateView(template_name="index.html"))` sert la SPA React pour toutes les autres URLs (`/app/...` côté frontend).
- API schema (Swagger/Redoc) si `ENABLE_API_SCHEMA=True` : `/api/schema/swagger/`

## 5) Endpoints clés

### Auth (JWT + session)

- `POST /api/auth/token/` — obtient un access + refresh token (JWT)
- `POST /api/auth/token/refresh/` — refresh
- `POST /api/auth/token/verify/` — vérification
- `POST /api/accounts/auth/login/` — login session (rate-limited 20/min/IP, 5/min/email)
- `POST /api/accounts/auth/logout/` — logout session
- `GET|POST /api/accounts/users/` + actions custom (`me`, `change-password`, `impersonate`, `avatar`)

### Entités métier (sous `/api/<app>/`)

- `households` (+ actions `members`, `invite`, `remove_member`, `update_role`, `leave`)
- `zones` (+ action `tree`)
- `interactions/interactions/`, `interaction-contacts/`, `interaction-structures/`, `interaction-documents/`
- `documents/documents/` (upload via multipart)
- `contacts/contacts|addresses|emails|phones/` (préfixe `/api/contacts/` mais l'app Django est `directory`)
- `structures/` (idem)
- `tags/tags/`, `tags/tag-links/`
- `equipment/equipment/`, `equipment/equipment-interactions/`
- `stock/stock-categories/`, `stock/stock-items/`
- `projects/projects/`, `project-groups/`, `project-zones/`, `project-ai-threads/`, `project-ai-messages/`
- `electricity/boards/`, `protective-devices/`, `circuits/`, `usage-points/`, `circuit-usage-point-links/`, `maintenance-events/`, `plan-change-logs/`
- `insurance/insurance-contracts/`
- `tasks/tasks/`, `task-documents/`, `task-interactions/`
- `notifications/` (read-only) + actions `unread_count`, `mark_read`, `mark_all_read`

### Routes frontend (SPA, pas de templates Django)

Définies dans `ui/src/router.tsx` :

- `/login` — login
- `/app/` → redirige vers `/app/dashboard`
- `/app/dashboard`, `/app/tasks`, `/app/zones`, `/app/zones/:id`
- `/app/interactions`, `/app/interactions/new`, `/app/interactions/:id/edit`
- `/app/projects`, `/app/projects/:id`
- `/app/equipment`, `/app/equipment/:id`
- `/app/stock`, `/app/documents`, `/app/documents/:id`, `/app/directory`
- `/app/electricity`, `/app/photos`, `/app/settings`
- `/app/admin/users`

### Permissions

- `IsAuthenticated` par défaut sur toutes les vues DRF
- `IsHouseholdMember` sur les ressources scopées au household
- `IsHouseholdOwner` pour `households` (update, delete, invite, remove_member, update_role)
- `CanViewPrivateContent` sur `Interaction` et `Document` (`is_private` + `created_by`)

## 6) Frontend SPA (`ui/src/`)

```
ui/src/
  main.tsx              # bootstrap React + QueryClient + i18n + router
  router.tsx            # routes react-router (toutes sous /app)
  components/           # AppShell, Sidebar, TopBar, ProtectedLayout, ListPage, EmptyState, CardActions, ConfirmDialog, ListSkeleton, PageHeader, TabShell, HouseholdSwitcher, ImpersonationBanner
  design-system/        # Button, Input, Card, Select, Textarea, Badge, Alert, Skeleton, Dialog, SheetDialog…
  features/<feature>/   # une feature = une page (TasksPage, ZonesPage, …)
    <Feature>Page.tsx
    <Item>Card.tsx
    <Item>Dialog.tsx
    hooks.ts            # query keys + TanStack Query hooks
  lib/
    api/<feature>.ts    # types + fetch fonctions (sans React)
    useDeleteWithUndo.ts, useDelayedLoading.ts, useSessionState.ts, …
  gen/api/              # types générés depuis OpenAPI (npm run gen:api:refresh)
  locales/{en,fr,de,es}/translation.json
  styles/, styles.css
```

**Aliases Vite** : `@/` → `ui/src/`, `@apps/` → `apps/` (à éviter dans le nouveau code).

**Pattern d'une feature** : voir `docs/FEATURE_PATTERN.md` (référence : `ui/src/features/tasks/`).

**Auth front** : `ui/src/lib/api/auth.ts` stocke les JWT, l'intercepteur fetch ajoute `Authorization: Bearer <token>`. Le refresh est automatique sur 401.

**Build** : un seul bundle (`main.tsx`) avec lazy-loading par page via `React.lazy`. Les chunks par page sont dans `static/react/assets/<Page>-<hash>.js`.

### Migration UI — état (avril 2026)

- ✅ **Complète** dans `ui/src/features/` : tasks, zones, interactions, projects, equipment, stock, documents, directory, electricity, photos, dashboard, settings, admin
- 🟡 **Partielle** : `accounts` (composants legacy dans `apps/accounts/react/` encore référencés), `households` (UI dans `features/settings/HouseholdManagement`), `tags` (pas de page dédiée — UI inline)
- 🔴 **Sans UI** : `insurance` (modèle + API en place), `notifications` (API uniquement)

## 7) Démarrage local

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
python manage.py migrate
python manage.py runserver
```

```bash
npm install
npm run dev
```

## 8) Tests

### Stratégie

- **Backend** : pytest uniquement. Couvrir les models, serializers, viewsets, permissions.
- **Frontend** : Playwright E2E uniquement. Pas de tests Vitest/unit sur les composants React — trop coûteux à maintenir pour la taille du projet.
- **Ce qu'on ne teste pas** : composants React isolés, hooks React, logique UI pure.

### Backend (pytest)

```bash
source .venv/bin/activate
pytest                          # tous les tests
pytest apps/<app>/              # tests d'une app
pytest -k "nom_du_test"
pytest -m "not slow"
```

L'agent `django-drf-test-writer` est disponible pour générer les tests backend automatiquement.

### Frontend E2E (Playwright)

```bash
# Le serveur Django doit tourner sur :8001 (npm run dev OU python manage.py runserver)
npm run test:e2e            # headless
npm run test:e2e:headed     # navigateur visible
npm run test:e2e:ui         # interface Playwright interactive
```

**Config** : `playwright.config.ts` à la racine. Tests dans `e2e/`.

**Auth** : `e2e/global.setup.ts` s'authentifie en premier et sauvegarde le state dans `e2e/.auth/user.json` (gitignored). Tous les tests réutilisent ce state — pas besoin de se re-logger.

**Credentials demo** (requiert `python manage.py seed_demo_data`) :
- Email : `claire.mercier@demo.local`
- Mot de passe : `demo1234`
- Ou via env : `E2E_EMAIL` / `E2E_PASSWORD`

**Conventions** :
- Sélecteurs par rôle (`getByRole`) et placeholder (`getByPlaceholder`) — jamais de classes CSS ni d'IDs
- Un fichier par feature : `e2e/tasks.spec.ts`, `e2e/auth.spec.ts`, etc.
- Tester les flux critiques : navigation, création, modification, suppression
- Ne pas tester les détails visuels (couleurs, espacements)

L'agent `playwright-e2e-writer` est disponible pour générer les tests E2E automatiquement après chaque nouvelle page ou feature frontend.

## 9) Règles IA recommandées

- Lire d'abord `config/urls.py`, le `views.py` + `serializers.py` de l'app concernée
- Éviter les refactors larges sans demande explicite
- **Pour ajouter une nouvelle page React** :
  1. Créer le composant feature dans `ui/src/features/<feature>/` (suivre `docs/FEATURE_PATTERN.md`)
  2. Ajouter l'API dans `ui/src/lib/api/<feature>.ts` (types + fetch fns)
  3. Ajouter les hooks TanStack Query dans `ui/src/features/<feature>/hooks.ts`
  4. Ajouter la route dans `ui/src/router.tsx` (avec `lazy()`)
  5. Ajouter les clés i18n dans les **4 locales** (`ui/src/locales/{en,fr,de,es}/translation.json`)
- **Pour ajouter une nouvelle app Django** :
  1. `python manage.py startapp <name>` dans `apps/<name>/`
  2. L'ajouter dans `INSTALLED_APPS` (`config/settings/base.py`)
  3. Hériter de `core.models.HouseholdScopedModel` (sauf cas exception)
  4. Inclure `path("api/<name>/", include("<name>.urls"))` dans `config/urls.py`
  5. Permissions `IsAuthenticated, IsHouseholdMember` par défaut
- **i18n** : jamais de `defaultValue` dans `t()`. Toujours mettre la clé dans les 4 locales.
- **Couleurs** : tokens design-system uniquement (cf. `CLAUDE.md` projet)
- **Tests** : pytest backend obligatoire pour viewset/permissions ; Playwright E2E pour les flux frontend critiques

## 10) Documentation par module

Voir `docs/MODULES/` pour l'état de chaque app : à corriger, à faire, à améliorer.

## 11) Archive legacy

L'ancien code `legacy/` a été archivé dans la branche `archive/legacy` puis supprimé du `main` (commit `e16edd8`).
Pour consulter l'intention métier d'origine, checkout cette branche.
