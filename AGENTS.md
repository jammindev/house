# AGENTS.md — Contexte projet (racine active)

Ce document donne le contexte rapide pour toute IA intervenant sur ce repo.

> Dernière mise à jour : mars 2026

## 1) Scope

- **Code actif principal**: racine Django + `apps/` + `ui/`
- **Contexte produit/migration**: `legacy/` (source documentaire)
- **Règle**: on implémente dans le code actif; on consulte `legacy/` pour comprendre l'intention fonctionnelle

## 1.1) Statut du projet (important)

La migration de données Supabase -> Django est **terminée sur le périmètre actif**.

Le projet est maintenant en phase **UI-first**: construction/complétion des interfaces web pour toutes les apps Django, en conservant l'architecture Django/DRF + templates + mini-SPA React ciblés par page.

Conséquence pour l'IA:

- Les docs `legacy/` restent utiles pour l'intention produit, mais ne bloquent plus la migration de données.
- Elles servent de **référence métier**, pas de vérité technique d'implémentation.
- En cas d'écart: la vérité runtime est dans `config/`, les apps Django dans `apps/`, `templates/`, et `ui/`.

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

## 3.1) Correspondance migration (legacy -> actif)

Porté côté Django (données migrées sur le périmètre actif) :

- `legacy` interactions/timeline -> `interactions` Django
- `legacy` zones hiérarchiques -> `zones` Django
- `legacy` documents/files -> `documents` Django
- `legacy` households/multi-tenant -> `households` + permissions `core`
- `legacy` auth Supabase -> `accounts` (session Django)
- `legacy` contacts -> `contacts` Django (modèles + API + page web)
- `legacy` structures -> `structures` Django (modèles + API)
- `legacy` equipment -> `equipment` Django (modèles + API + page web)
- `legacy` projects -> `projects` Django (modèles + API + page web, dont threads IA)
- `legacy` incoming emails -> `incoming_emails` Django (historisé, hors périmètre UI prioritaire actuel)
- `legacy` electricity -> `electricity` Django (modèles + API + mini-SPA React)

Prochaine phase prioritaire :

- Construire/compléter l'UI de toutes les apps actives côté Django
- Uniformiser les pages `/app/*` avec le design system partagé
- Finaliser les mini-SPA React ciblées par feature/page

Règle de portage UI (stricte) :

- Reprendre **exactement** les mêmes composants React que dans `legacy/` quand ils existent
- Conserver **la même découpe de fichiers** que `legacy` (`(pages)` et `features`)
- Adapter uniquement les éléments spécifiques Next.js/Supabase (routing, data loading, server actions, auth, image/link), vers le fonctionnement Django/DRF + Vite
- Éviter les réécritures structurelles inutiles: même architecture fonctionnelle, adaptation technique minimale

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

### Permissions (legacy RLS -> Django)

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

### Composants React par app

- `apps/interactions/react/`: `InteractionList.tsx`, `InteractionCreateForm.tsx`, `mount-interactions.tsx`, `mount-interaction-new.tsx`
- `apps/electricity/react/`: `ElectricityBoardNode.tsx`, `mount-electricity.tsx`
- `apps/projects/react/`: composants projet
- `apps/equipment/react/`: composants équipement
- `apps/tasks/react/`: composants tâches
- `apps/photos/react/`: composants photos

### Pattern de montage ciblé

Chaque page Django inclut un `<div id="react-root">` que le script `mount-<app>.tsx` cible via `ui/src/lib/mount.tsx`.

## 7) Démarrage local

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
python manage.py migrate
python manage.py runserver 8000
```

```bash
npm install
npm run dev
```

## 8) Tests

```bash
pytest
```

## 9) Règles IA recommandées

- Lire d'abord `config/urls.py`, les `views.py`/`views_web.py` et `serializers.py` concernés
- Éviter les refactors larges sans demande explicite
- Préserver le pattern Django-routed + mini-SPA React ciblés
- Chaque nouvelle app web doit avoir `web_urls.py` + `views_web.py` distincts des vues API
- Utiliser `legacy/` comme documentation fonctionnelle de migration, pas comme base de code à copier
- Le `i18n_patterns` dans `config/urls.py` enveloppe toutes les URLs web (`/app/...`)

## 10) Docs legacy à consulter quand on manque de contexte

- `legacy/AGENTS.md`: contexte produit complet historique (haute valeur)
- `legacy/README.md`: vision produit/features globales
- `legacy/STRUCTURE.md`: organisation feature-first Next.js
- `legacy/AI_UPDATE_WORKFLOW.md`: checklist de modification utile
- `legacy/RESUME-PROJECT.md`: intention métier centrée sur le modèle interaction
