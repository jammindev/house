# AI Context — API Map (active code)

## Router global

`config/urls.py`

- `/api/` -> router DRF (`users`, `auth`)
- `/api/households/` -> `households.urls`
- `/api/zones/` -> `zones.urls`
- `/api/documents/` -> `documents.urls`
- `/api/interactions/` -> `interactions.urls`
- `/api/contacts/` -> `contacts.urls`
- `/api/structures/` -> `structures.urls`
- `/api/tags/` -> `tags.urls`
- `/api/todo/` -> `todo_list.urls`

## Accounts

- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET|POST /api/users/`
- `GET|PUT|PATCH|DELETE /api/users/{id}/`

## Households

Base: `/api/households/`

Actions:
- `GET /{id}/members/`
- `POST /{id}/leave/`
- `POST /{id}/invite/` (owner only, placeholder)
- `POST /{id}/remove_member/` (owner only)
- `POST /{id}/update_role/` (owner only)

## Zones

Base: `/api/zones/`

Actions:
- `GET /tree/?household_id=...`
- `GET /{id}/children/`
- `GET /{id}/photos/`
- `POST /{id}/attach_photo/`

## Documents

Base réelle actuelle:
- `/api/documents/documents/`

Actions:
- `GET /api/documents/documents/by_type/`
- `POST /api/documents/documents/{id}/reprocess_ocr/`

## Interactions

Base réelle actuelle:
- `/api/interactions/interactions/`

Actions:
- `GET /api/interactions/interactions/by_type/`
- `GET /api/interactions/interactions/tasks/`
- `PATCH /api/interactions/interactions/{id}/update_status/`

Liens legacy portés:
- `CRUD /api/interactions/interaction-contacts/`
- `CRUD /api/interactions/interaction-structures/`

## Contacts

Base:
- `CRUD /api/contacts/contacts/`
- `CRUD /api/contacts/addresses/`
- `CRUD /api/contacts/emails/`
- `CRUD /api/contacts/phones/`

## Structures

Base:
- `CRUD /api/structures/`

## Tags

Base:
- `CRUD /api/tags/tags/`
- `CRUD /api/tags/interaction-tags/`

## Todo (legacy template)

Base:
- `CRUD /api/todo/`

## Notes de vigilance

- Résolution du household côté API: `X-Household-Id` (header) puis `household_id` (query/body), sinon auto-sélection si l’utilisateur n’a qu’un seul household.
- Permissions alignées migration legacy RLS:
	- membre household: accès CRUD sur zones/interactions/documents du household
	- owner household: opérations de gestion des membres (`invite`, `remove_member`, `update_role`) + update/delete household
- `documents` et `interactions` ont un double segment de route (actuel).
