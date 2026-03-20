# Security Review — House (Django + React)

> Généré le 2026-03-19. À traiter avant passage en production.

---

## Actions immédiates (aujourd'hui)

- [x] **Rotation de tous les secrets** : `SECRET_KEY`, password DB, clés Supabase, tokens OCR — ✅ à faire côté Supabase (hors repo)
- [x] **Vérifier le `.gitignore`** : `.env*` non tracké, confirmé ✅
- [x] **Restreindre l'endpoint users** aux staff uniquement — ✅ `fcbf524` (non-staff retourne uniquement son propre utilisateur)
- [x] **Logger les impersonations** (qui, quoi, quand) — ✅ `fcbf524` (`logger.info` avec admin id, target id, timestamp)

---

## Critique

### ✅ 1. Secrets exposés dans le repo
**Fichiers :** `.env`, `.env.local`

**Résolu :** `.env*` non tracké dans git (confirmé). Rotation des clés Supabase à faire directement sur le dashboard Supabase. `.env.production.example` ajouté comme référence sans valeurs réelles.

---

### ⚠️ 2. JWT stockés en `localStorage` *(déféré — post-prod)*
**Fichier :** `ui/src/lib/auth/context.tsx`

```typescript
localStorage.setItem('access_token', data.access);
localStorage.setItem('refresh_token', data.refresh);
// Tokens admin stockés en clair lors de l'impersonation
localStorage.setItem('_impersonator_tokens', JSON.stringify({ ... }));
```

Les tokens en `localStorage` sont lisibles par tout JavaScript → vulnérables au XSS.

**Partiel :** `_impersonator_tokens` nettoyé du `localStorage` lors de l'expiry de session (`fcbf524`). Migration complète vers `httpOnly` cookies déférée post-prod (refactoring important).

**Reste à faire :**
- Migrer vers des cookies `httpOnly; Secure; SameSite=Strict`
- Stocker le contexte d'impersonation côté serveur (session courte durée), pas en clair côté client

---

### ✅ 3. Endpoint users expose tous les utilisateurs
**Fichier :** `apps/accounts/views/api.py`

**Résolu (`fcbf524`) :** `GET /api/accounts/users/` retourne uniquement l'utilisateur courant pour les non-staff. Les staff voient tous les utilisateurs. `is_active` passé en `read_only_fields`.

---

### ✅ 4. Aucun audit trail sur l'impersonation
**Fichier :** `apps/accounts/views/api.py`

**Résolu (`fcbf524`) :** `logger.info("Impersonation: admin=%s (id=%s) impersonating user=%s (id=%s)", ...)` ajouté. Les logs partent dans le système de logs Django (stdout en prod → collectés par Docker).

*Reste déféré :* notification email à l'utilisateur cible, tracking des sessions actives.

---

## Élevé

### 5. `DEBUG=True` + `CORS_ALLOW_ALL_ORIGINS=True` en local
**Fichier :** `config/settings/local.py`

Risque si ces settings fuitent en staging/prod : stack traces exposées, CORS ouvert à tous.

**Actions :**
- S'assurer que ces settings ne sont jamais actifs hors dev local
- Ajouter une vérification explicite au démarrage en prod

---

### ✅ 6. Mass assignment sur `UserSerializer`
**Fichier :** `apps/accounts/serializers.py`

**Résolu (`fcbf524`) :** `is_active` ajouté à `read_only_fields = ["id", "is_active", "is_staff", "date_joined", "full_name"]`.

---

### ✅ 7. Upload de fichiers sans validation du contenu
**Fichier :** `apps/documents/views.py`, `apps/accounts/views/api.py`

**Résolu (`fcbf524`) :** `apps/core/file_validation.py` — détection des magic bytes en pur Python (JPEG, PNG, GIF, WebP, PDF). Utilisé pour les documents (max 20 MB) et les avatars (max 2 MB). Le MIME détecté est stocké en base, pas le content-type client.

*Note :* `Content-Disposition: attachment` non ajouté — les fichiers sont servis via Nginx avec le content-type natif. À envisager si besoin de forcer le téléchargement.

---

### ✅ 8. Fichiers servis via `/media/` sans contrôle de permission (IDOR)
**Fichiers :** `apps/core/views_media.py`, `nginx/default.conf`, `config/urls.py`

**Résolu (`fcbf524`) :**
- `/media/<path>` passe désormais par Django (`serve_protected_media`) : 401 si non authentifié, 403 si non-membre du household ou si document privé d'un autre membre
- En prod : Django retourne `X-Accel-Redirect: /_protected_media/<path>` → Nginx sert le fichier depuis un emplacement interne (`internal;`)
- En dev : Django sert le fichier directement

*Déféré :* URLs signées avec expiration (S3 presigned URLs) — pour plus tard si migration vers objet storage.

---

## Moyen

### 9. Pas de Content Security Policy (CSP)
Aucun header CSP n'est configuré → XSS non mitigé côté browser.

**Action :** Ajouter `django-csp` ou configurer les headers manuellement en production.

---

### 10. Rate limiting insuffisant
Le login a un throttle (bien), mais pas `/change-password/`, ni l'inscription, ni la liste des users.

**Actions :**
- `change-password` : 5 tentatives / heure
- Inscription : 10 / heure / IP
- Liste users : 100 / heure / utilisateur

---

### ✅ 11. Refresh token sans backoff ni logout propre
**Fichier :** `ui/src/lib/axios.ts`

**Résolu (`fcbf524`) :** En cas d'échec du refresh, tous les tokens sont nettoyés (`access_token`, `refresh_token`, `_impersonator_tokens`) et la page est redirigée vers `/login`. Pas de retry infini.

---

### 12. `CORS_ALLOWED_ORIGINS` sans erreur si absent en prod
**Fichier :** `config/settings/production.py`

`default=[]` → silencieusement vide si la variable d'env est absente.

**Action :** Lever une erreur au démarrage si `CORS_ALLOWED_ORIGINS` n'est pas configuré en production.

---

### 13. Filtrage des tags par split de string
**Fichier :** `apps/interactions/views.py` (l. 54-80)

```python
tag_list = tags.split(',')  # virgules extras → entrées vides
```

**Action :** Nettoyer la liste avec `[t.strip() for t in tags.split(',') if t.strip()]` ou utiliser `DjangoFilterBackend`.

---

### 14. Pas d'audit logging général
Aucune trace des modifications sensibles (changement de mot de passe, suppression de tâches/documents, changements de permissions).

**Action :** Implémenter un système d'audit log (middleware ou signals Django) avec : action, utilisateur, timestamp, objet affecté.

---

### 15. Pas de 2FA / MFA
L'authentification est uniquement par mot de passe, y compris pour les comptes admin.

**Action :** Implémenter TOTP optionnel (`django-otp`), obligatoire pour les staff/admin, requis avant d'utiliser l'impersonation.

---

## Bas

- **Session cookies** : vérifier que `SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SECURE=True`, `SESSION_COOKIE_SAMESITE='Strict'` sont définis en production
- **Headers manquants en prod** : ajouter `Permissions-Policy` (caméra, micro, géoloc désactivés)
- **Validation des champs serializer** : ajouter `max_length`, validateurs d'URL, `ChoiceField` pour les enums
- **Dépendances** : lancer `pip audit` + configurer Dependabot

---

## Ce qui est déjà bien

- `X-Frame-Options: DENY` configuré
- `X-Content-Type-Options: nosniff` actif
- `SECURE_REFERRER_POLICY: same-origin` défini
- `SECURE_HSTS_*` configuré pour la production
- Throttle sur le login (IP + email)
- Permissions objet sur les tâches (créateur vs assigné)
- Django 5.2 + DRF 3.16 à jour
