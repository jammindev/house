# Contract: User Avatar Upload / Delete

## POST /api/accounts/users/me/avatar/

**Auth**: Session cookie Django requis  
**Content-Type**: `multipart/form-data`

### Request body

| Champ | Type | Obligatoire | Contraintes |
|-------|------|-------------|-------------|
| `avatar` | fichier image | oui | type image/* ; taille ≤ 2 MB |

### Response 200

```json
{
  "avatar_url": "/media/avatars/uuid/avatar.jpg"
}
```

### Response 400 (validation)

```json
{
  "avatar": ["File size exceeds 2 MB limit."]
}
```

```json
{
  "avatar": ["Upload a valid image. The file you uploaded was either not an image or a corrupted image."]
}
```

---

## DELETE /api/accounts/users/me/avatar/

**Auth**: Session cookie Django requis

### Response 200

```json
{
  "detail": "Avatar removed."
}
```

### Response 400 (pas d'avatar)

```json
{
  "detail": "No avatar to delete."
}
```
