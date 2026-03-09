# Contract: Household Management (référence endpoints existants)

> Tous ces endpoints existent déjà dans `apps/households/`. Ce document les liste pour référence dans le contexte de la page settings.

## GET /api/households/

**Auth**: Session cookie + `X-Household-Id` ou auto-sélection  
Retourne tous les households de l'utilisateur courant.

## POST /api/households/

Crée un nouveau household. L'utilisateur devient owner automatiquement.

**Request** :
```json
{
  "name": "Mon appartement",
  "address": "",
  "city": "",
  "country": "",
  "context_notes": "",
  "ai_prompt_context": ""
}
```

## GET /api/households/{id}/

Détail d'un household (membre ou owner requis).

## PATCH /api/households/{id}/

Modification d'un household (owner requis).

## DELETE /api/households/{id}/

Suppression d'un household (owner requis).

## GET /api/households/{id}/members/

Liste des membres du household.

**Response** :
```json
[
  {
    "user_id": "uuid",
    "email": "alice@example.com",
    "display_name": "Alice",
    "role": "owner",
    "date_joined": "2025-01-01T00:00:00Z"
  }
]
```

## POST /api/households/{id}/leave/

L'utilisateur courant quitte le household (membre requis — owner ne peut pas quitter).

## POST /api/households/{id}/invite/

Invite un utilisateur par email.

**Request** :
```json
{"email": "bob@example.com"}
```

## POST /api/households/{id}/remove_member/

Retire un membre (owner requis).

**Request** :
```json
{"user_id": "uuid"}
```

## POST /api/households/{id}/update_role/

Change le rôle d'un membre (owner requis).

**Request** :
```json
{"user_id": "uuid", "role": "member"}
```
