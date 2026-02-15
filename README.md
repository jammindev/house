# House — Django + React hybride

Projet principal: backend Django (SSR + API REST) avec zones React intégrées via Vite.

> Note: le dossier `legacy/` existe dans le dépôt mais n’est pas la base active de cette app.

## Stack

- Django 5 + Django REST Framework
- Auth session Django (cookies + CSRF)
- PostgreSQL (local/prod), SQLite en test
- React 19 + Vite + TypeScript
- `django-vite` pour charger les assets frontend côté templates

## Architecture rapide

- **Pages serveur**: Django templates (`/login`, `/dashboard`, etc.)
- **API**: endpoints sous `/api/...`
- **UI interactive**: composants React / Web Components buildés dans `static/react`
- **i18n**: anglais + français

Voir aussi: `HYBRID_ARCHITECTURE.md`.

## Structure utile (hors `legacy/`)

```text
.
├── manage.py
├── config/                 # settings + urls
├── accounts/               # user/auth + vues login/dashboard
├── households/             # multi-tenant household
├── zones/                  # hiérarchie de zones
├── interactions/           # journal d'événements
├── documents/              # pièces jointes / OCR
├── contacts/               # contacts + addresses/emails/phones
├── structures/             # structures/prestataires
├── tags/                   # tags + liaisons interactions
├── todo_list/              # table legacy template
├── core/                   # modèles/permissions partagés
├── templates/              # pages Django
├── static/                 # assets statiques (dont build React)
└── frontend/               # source React/Vite
```

## Setup local

### 1) Backend Django

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000
```

`manage.py` utilise `config.settings.local` par défaut.

### 2) Frontend React (dans un 2e terminal)

```bash
npm install
npm run dev
```

Pour rebuild continu des assets de prod:

```bash
npm run dev:watch
```

## Build production

```bash
npm run build
python manage.py collectstatic --noinput
DJANGO_SETTINGS_MODULE=config.settings.production gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

## Settings

- `config/settings/base.py`: socle commun
- `config/settings/local.py`: développement (`.env.local`)
- `config/settings/production.py`: production (`.env`)
- `config/settings/test.py`: tests (SQLite in-memory)

## Endpoints principaux

### Auth / users

- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET|POST /api/users/`
- `GET|PUT|PATCH|DELETE /api/users/{id}/`

### Domain API

- `api/households/` (DRF ViewSet + actions `members`, `leave`, `invite`, `remove_member`, `update_role`)
- `api/zones/` (DRF ViewSet + actions `tree`, `children`, `photos`, `attach_photo`)
- `api/documents/documents/` (ViewSet documents)
- `api/interactions/interactions/` (ViewSet interactions)
- `api/contacts/contacts|addresses|emails|phones/` (CRUD legacy)
- `api/structures/` (CRUD legacy)
- `api/tags/tags|interaction-tags/` (CRUD legacy)
- `api/interactions/interaction-contacts|interaction-structures/` (CRUD legacy)
- `api/todo/` (CRUD legacy template)

## Permissions multi-tenant (Django)

- Modèle inspiré de la logique legacy RLS, implémenté côté DRF via `core/permissions.py`.
- Résolution du household courant: header `X-Household-Id`, puis `household_id` (query/body), sinon auto-sélection si un seul household.
- Règles métier:
	- membres household: CRUD sur zones/interactions/documents de leur household
	- owners household: gestion des membres (`invite`, `remove_member`, `update_role`) et update/delete household

## Pages Django

- `/login/`
- `/dashboard/`
- `/test-components/`
- `/admin/`

Routes i18n activées (`/fr/...`, `/en/...`, avec préfixe langue par défaut désactivé).

## Tests

```bash
pytest
```

Configuration dans `pytest.ini` avec couverture sur l’app `accounts`.
