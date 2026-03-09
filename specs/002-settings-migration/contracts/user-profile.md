# Contract: User Profile (GET + PATCH)

## GET /api/accounts/users/me/

**Auth**: Session cookie Django requis  
**Scope**: Utilisateur courant uniquement

### Response 200

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Alice",
  "locale": "fr",
  "theme": "dark",
  "avatar_url": "/media/avatars/uuid/avatar.jpg",
  "avatar": "/media/avatars/uuid/avatar.jpg",
  "first_name": "",
  "last_name": "",
  "full_name": "",
  "is_active": true,
  "is_staff": false,
  "date_joined": "2025-01-01T00:00:00Z"
}
```

---

## PATCH /api/accounts/users/me/

**Auth**: Session cookie Django requis  
**Content-Type**: `application/json`

### Request body (partiel — tous les champs sont optionnels)

```json
{
  "display_name": "Alice Martin",
  "locale": "fr",
  "theme": "dark"
}
```

**Règles** :
- `locale` : doit être `en`, `fr`, `de` ou `es`
- `theme` : doit être `light`, `dark` ou `system`
- `email` est en lecture seule (ignoré si envoyé)

### Response 200

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Alice Martin",
  "locale": "fr",
  "theme": "dark",
  ...
}
```

### Response 400 (validation)

```json
{
  "locale": ["Value 'xx' is not a valid choice."]
}
```

### Response 401

```json
{"detail": "Authentication credentials were not provided."}
```
