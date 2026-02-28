# Contract: Change Password

## POST /api/accounts/users/me/change-password/

**Auth**: Session cookie Django requis  
**Content-Type**: `application/json`

### Request body

```json
{
  "new_password": "MyNewS3cur3Pass",
  "confirm_password": "MyNewS3cur3Pass"
}
```

**Règles** :
- `new_password` et `confirm_password` sont obligatoires
- `new_password.length >= 8`
- `new_password == confirm_password` (validé côté serveur)

### Response 200

```json
{
  "detail": "Password updated successfully."
}
```

### Response 400 (mots de passe différents)

```json
{
  "detail": "Passwords do not match."
}
```

### Response 400 (trop court)

```json
{
  "detail": "Password must be at least 8 characters."
}
```

### Response 401

```json
{"detail": "Authentication credentials were not provided."}
```
