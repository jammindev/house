# AGENTS.md — Contexte projet (racine active)

Ce document donne le contexte rapide pour toute IA intervenant sur ce repo.

> Dernière mise à jour : mars 2026

## 1) Scope

- **Code actif principal**: racine Django + `apps/` + `ui/`
- **Archive historique**: `legacy/` (référence métier uniquement)
- **Règle**: on implémente dans le code actif; on consulte `legacy/` uniquement pour comprendre l'intention fonctionnelle

## 1.1) Statut du projet (important)

Le projet est en phase **UI-first**: construction/complétion des interfaces web pour toutes les apps Django, en conservant l'architecture Django/DRF + templates + mini-SPA React ciblés par page.

Objectifs actuels:

- Construire/compléter l'UI de toutes les apps actives côté Django
- Uniformiser les pages `/app/*` avec le design system partagé
- Finaliser les mini-SPA React ciblées par feature/page

Pour l'IA:

- Les docs `legacy/` sont une archive métier, pas la source de vérité technique.
- La vérité runtime est dans `config/`, les apps Django dans `apps/`, `templates/`, et `ui/`.

## 2) Stack

- Backend: Django 5, DRF, auth session Django, django-filter, drf-spectacular (OpenAPI)
- DB: PostgreSQL (local/prod), SQLite in-memory (tests)
- Frontend: React 19, TypeScript, Vite
- Intégration Django/React: `django-vite`
- Templates: Alpine.js (interactions UI mobiles), HTMX (hx-boost navigation SPA-like), Tailwind CSS, Lucide icons

## 3) Apps Django

### Apps avec modèles + API DRF + pages web

- `accounts`: utilisateur custom + auth session Django + vues home/login/dashboard; `throttles.py` (rate limiting login: 20/min/IP, 5/min/email)
- `households`: entité multi-tenant de base
- `zones`: hiérarchie spatiale
- `interactions`: journal (note, todo, expense, maintenance...) + liens contacts/structures/documents
- `documents`: fichiers/OCR/métadonnées
- `contacts`: contacts + addresses/emails/phones
- `structures`: structures/prestataires/organisations
- `tags`: tags + liens interaction-tags
- `equipment`: équipements, cycle de vie, liens avec interactions (`EquipmentInteraction`)
- `projects`: projets (`Project`, `ProjectGroup`, `ProjectZone`), threads IA (`ProjectAIThread`, `ProjectAIMessage`)
- `electricity`: tableau électrique, RCDs, disjoncteurs, circuits, points d'usage, liens, changelog
- `incoming_emails`: emails entrants + pièces jointes, pipeline de traitement (pending/processing/processed/failed)

### Apps web-only (pas de modèles propres — utilisent les APIs existantes)

- `tasks`: mini-app tasks (web + React), s'appuie sur l'API interactions
- `photos`: mini-app photos (web + React)
- `app_settings`: mini-app paramètres

### App transverse

- `core`: modèles abstraits (`HouseholdScopedModel`), managers (`HouseholdScopedManager`), permissions (`IsHouseholdMember`)

## 4) Conventions techniques importantes

- Modèle user custom: `AUTH_USER_MODEL = "accounts.User"`
- Les modèles métier utilisent `HouseholdScopedModel` (champ `household` + manager scopé)
- Permissions multi-tenant via `IsHouseholdMember`
- Résolution household API: `X-Household-Id` -> `household_id` (query/body) -> auto-select si membership unique
- Rate limiting login: `accounts/throttles.py` — `LoginIPRateThrottle` (20/min par IP) + `LoginEmailRateThrottle` (5/min par email), configurable via `DEFAULT_THROTTLE_RATES` dans `REST_FRAMEWORK`
- Cache throttle: `LocMemCache` en dev; brancher Redis (`django-redis`) en prod pour cohérence multi-workers
- Routes API dans `config/urls.py` sous `api/<app>/`
- Routes web dans `config/urls.py` sous `i18n_patterns` -> `app/<section>/`
- Pages web dans `templates/app/` ou `apps/<app>/templates/`
- Chaque app avec page web a un `web_urls.py` + `views_web.py` séparés des vues API
- API schema (Swagger/Redoc) disponible si `ENABLE_API_SCHEMA=True` -> `/api/schema/swagger/`
- **Pattern ReactPageView** : les vues web héritent de `core.views.ReactPageView` qui fournit un template générique (`templates/core/react_page.html`). Les class attributes déclarent `page_title`, `page_description`, `page_actions_template`, `react_root_id`, `props_script_id`, `page_vite_asset`. La méthode `get_props()` retourne le dict initial hydraté côté Django — **zéro fetch API React au premier rendu**. Pour ajouter des boutons d'action dans le header, définir `page_actions_template` vers un partial (ex: `"app/partials/_actions.html"`). Pour un template custom complet, surcharger `template_name`.

## 5) Endpoints clés

### Auth + Users

- `POST /api/accounts/login/` — rate-limited (20/min par IP, 5/min par email)
- `POST /api/accounts/logout/`
- `GET|POST /api/accounts/users/`

### Entités métier

- `GET|POST|... /api/households/`
- `GET|POST|... /api/zones/`
- `GET|POST|... /api/interactions/interactions/`
- `GET|POST|... /api/interactions/interaction-contacts/`
- `GET|POST|... /api/interactions/interaction-structures/`
- `GET|POST|... /api/interactions/interaction-documents/`
- `GET|POST|... /api/documents/documents/`
- `GET|POST|... /api/contacts/contacts/`
- `GET|POST|... /api/contacts/addresses/`
- `GET|POST|... /api/contacts/emails/`
- `GET|POST|... /api/contacts/phones/`
- `GET|POST|... /api/structures/`
- `GET|POST|... /api/tags/tags/`
- `GET|POST|... /api/tags/interaction-tags/`
- `GET|POST|... /api/equipment/`
- `GET|POST|... /api/equipment/equipment-interactions/`
- `GET|POST|... /api/projects/projects/`
- `GET|POST|... /api/projects/project-groups/`
- `GET|POST|... /api/projects/project-zones/`
- `GET|POST|... /api/projects/project-ai-threads/`
- `GET|POST|... /api/projects/project-ai-messages/`

### Électricité

- `GET|POST|... /api/electricity/boards/`
- `GET|POST|... /api/electricity/rcds/`
- `GET|POST|... /api/electricity/breakers/`
- `GET|POST|... /api/electricity/circuits/`
- `GET|POST|... /api/electricity/usage-points/`
- `GET|POST|... /api/electricity/links/`
- `GET /api/electricity/change-logs/`
- `GET /api/electricity/mapping/lookup/`
- `POST /api/electricity/links/{id}/deactivate/`

### Emails entrants

- `GET|POST|... /api/incoming/incoming-emails/`
- `GET|POST|... /api/incoming/incoming-email-attachments/`

### Pages web (`/app/`)

- `/app/dashboard/`: tableau de bord
- `/app/interactions/`: journal d'interactions (avec mini-SPA React — `InteractionList`, `InteractionCreateForm`)
- `/app/interactions/new/`: création d'interaction
- `/app/zones/`: hiérarchie spatiale
- `/app/contacts/`: contacts
- `/app/documents/`: documents
- `/app/equipment/`: équipements
- `/app/electricity/`: tableau électrique (mini-SPA React — `ElectricityBoardNode`)
- `/app/projects/`: projets
- `/app/tasks/`: tâches (mini-SPA React)
- `/app/photos/`: photos (mini-SPA React)
- `/app/settings/`: paramètres
- `/app/components/`: démo du design system

### Permissions

- `zones`, `interactions`, `documents`, `equipment`, `projects`: accès membre household
- `households`:
	- membre: `retrieve`, `members`, `leave`
	- owner: `update`, `delete`, `invite`, `remove_member`, `update_role`

## 6) Frontend hybride

### Design system partagé (`ui/src/`)

- `ui/src/design-system/*`: composants atomiques (Button, Input, Card, Select, Textarea, Badge, Alert, Skeleton)
- `ui/src/web-components/*`: mêmes composants exposés en Web Components custom elements (`<ui-button>`, etc.) + `InteractionCreateForm`, `InteractionList`
- `ui/src/lib/mount.tsx`: utilitaire de montage React ciblé dans un nœud DOM
- `ui/src/lib/api/`: client API généré (fetch typé vers les endpoints DRF)

### Organisation du code React

**Composants métier** (`apps/<app>/react/`)  
Les composants React contenant la logique métier restent dans `apps/<app>/react/`, à proximité des modèles Django et serializers correspondants :
- `apps/interactions/react/`: `InteractionList.tsx`, `InteractionCreateForm.tsx`
- `apps/electricity/react/`: `ElectricityBoardNode.tsx`
- `apps/projects/react/`: `ProjectList.tsx`, `ProjectDetail.tsx`, `ProjectForm.tsx`, `ProjectGroupList.tsx`, `ProjectGroupDetail.tsx`
- `apps/equipment/react/`: composants équipement
- `apps/stock/react/`: composants stock
- `apps/directory/react/`: `DirectoryPage.tsx`, `ContactCreateForm.tsx`, `ContactDetailsView.tsx`, `ContactEditForm.tsx`, `StructureForm.tsx`, `StructureDetailView.tsx`
- `apps/zones/react/`: `ZonesNode.tsx`, `ZoneDetailNode.tsx`
- `apps/tasks/react/`: `TasksPage.tsx`
- `apps/photos/react/`: `PhotosPage.tsx`
- `apps/documents/react/`: `DocumentsPage.tsx`
- `apps/app_settings/react/`: `UserSettings.tsx`

**Points d'entrée de montage** (`ui/src/pages/<app>/`)  
Les fichiers de montage qui hydratent les composants sont organisés par app dans `ui/src/pages/` :

```
ui/src/pages/
  interactions/
    list.tsx          # monte InteractionList
    new.tsx           # monte InteractionCreateForm
  projects/
    list.tsx          # monte ProjectList
    detail.tsx        # monte ProjectDetail
    new.tsx           # monte ProjectForm (mode create)
    edit.tsx          # monte ProjectForm (mode edit)
    groups.tsx        # monte ProjectGroupList
    group-detail.tsx  # monte ProjectGroupDetail
  equipment/
    list.tsx, detail.tsx, new.tsx, edit.tsx
    stock-list.tsx, stock-detail.tsx, stock-new.tsx, stock-edit.tsx
  contacts/
    list.tsx, new.tsx, detail.tsx, edit.tsx
  structures/
    new.tsx, detail.tsx, edit.tsx
  zones/
    list.tsx, detail.tsx
  electricity/
    board.tsx
  tasks/
    list.tsx
  photos/
    list.tsx
  documents/
    list.tsx
  settings/
    index.tsx
```

Chaque fichier de montage :
1. Importe le composant depuis `apps/<app>/react/`
2. Utilise `mountWithJsonScriptProps` et `onDomReady` de `@/lib/mount`
3. Cible un root DOM spécifique (ex: `'projects-list-root'`)
4. Les props initiales sont hydratées côté Django via `ReactPageView.get_props()` — **zéro fetch API au premier rendu**

**Configuration Vite**  
Les points d'entrée dans `vite.config.ts` pointent vers `ui/src/pages/<app>/` et gardent les mêmes keys pour compatibilité avec les templates Django :
```typescript
'projects': resolve(__dirname, 'src/pages/projects/list.tsx'),
'project-detail': resolve(__dirname, 'src/pages/projects/detail.tsx'),
```

### Avantages de cette organisation

✅ **Composants métier près du backend** : facilite la maintenance modèle Django ↔ serializer ↔ composant React  
✅ **Montage centralisé** : tous les points d'entrée Vite regroupés logiquement dans `ui/src/pages/`  
✅ **Structure miroir** : `ui/src/pages/` reflète l'organisation de `apps/`  
✅ **Scalabilité** : facile d'ajouter de nouvelles pages à une app existante

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

- Lire d'abord `config/urls.py`, les `views.py`/`views_web.py` et `serializers.py` concernés
- Éviter les refactors larges sans demande explicite
- Préserver le pattern Django-routed + mini-SPA React ciblés
- Chaque nouvelle app web doit avoir `web_urls.py` + `views_web.py` distincts des vues API
- **Pour ajouter une page React** :
  1. Créer le composant métier dans `apps/<app>/react/`
  2. Créer le fichier de montage dans `ui/src/pages/<app>/`
  3. Ajouter l'entrée dans `ui/vite.config.ts`
  4. Créer la vue Django qui hérite de `ReactPageView`
- Consulter `legacy/` uniquement pour la compréhension métier, jamais comme référence technique
- Le `i18n_patterns` dans `config/urls.py` enveloppe toutes les URLs web (`/app/...`)

## 10) Archive legacy (référence métier uniquement)

- `legacy/AGENTS.md`: contexte produit complet historique (haute valeur)
- `legacy/README.md`: vision produit/features globales
- `legacy/RESUME-PROJECT.md`: intention métier centrée sur le modèle interaction
