# Security Review — House (Django + React)

> Généré le 2026-03-19. À traiter avant passage en production.

---

## Actions immédiates (aujourd'hui)

- [ ] **Rotation de tous les secrets** : `SECRET_KEY`, password DB, clés Supabase, tokens OCR
- [ ] **Vérifier le `.gitignore`** : `git check-ignore -v .env` — si tracké, retirer de l'historique avec BFG Repo-Cleaner
- [ ] **Restreindre l'endpoint users** aux staff uniquement
- [ ] **Logger les impersonations** (qui, quoi, quand)

---

## Critique

### 1. Secrets exposés dans le repo
**Fichiers :** `.env`, `.env.local`

Les fichiers contiennent en clair :
- `SECRET_KEY`
- Password de la base de données (`DATABASE_URL`)
- Clés Supabase (anon + service role)
- Tokens OCR

**Actions :**
- Rotation immédiate de tous les secrets
- S'assurer que `.env*` est dans `.gitignore`
- Vérifier que ces fichiers ne sont pas dans l'historique git (`git log --all -- .env`)
- Si committés : utiliser [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

---

### 2. JWT stockés en `localStorage`
**Fichier :** `ui/src/lib/auth/context.tsx`

```typescript
localStorage.setItem('access_token', data.access);
localStorage.setItem('refresh_token', data.refresh);
// Tokens admin stockés en clair lors de l'impersonation
localStorage.setItem('_impersonator_tokens', JSON.stringify({ ... }));
```

Les tokens en `localStorage` sont lisibles par tout JavaScript → vulnérables au XSS.

**Actions :**
- Migrer vers des cookies `httpOnly; Secure; SameSite=Strict`
- Stocker le contexte d'impersonation côté serveur (session courte durée), pas en clair côté client

---

### 3. Endpoint users expose tous les utilisateurs
**Fichier :** `apps/accounts/views/api.py` (l. 70-82)

`GET /api/accounts/users/` retourne tous les utilisateurs (emails, noms, avatars) aux non-staff.

**Actions :**
- Restreindre la liste aux staff avec une permission explicite
- Pour les non-staff : ne retourner que l'utilisateur courant
- Retirer `is_staff` de la réponse sérialisée pour les non-staff

---

### 4. Aucun audit trail sur l'impersonation
**Fichier :** `apps/accounts/views/api.py` (l. 152-166)

Aucun log de qui a impersonné qui et quand. Impossible de détecter un abus.

**Actions :**
- Logger chaque impersonation : admin, cible, timestamp
- Envisager une notification email à l'utilisateur cible
- Ajouter un tracking des sessions d'impersonation actives

---

## Élevé

### 5. `DEBUG=True` + `CORS_ALLOW_ALL_ORIGINS=True` en local
**Fichier :** `config/settings/local.py`

Risque si ces settings fuitent en staging/prod : stack traces exposées, CORS ouvert à tous.

**Actions :**
- S'assurer que ces settings ne sont jamais actifs hors dev local
- Ajouter une vérification explicite au démarrage en prod

---

### 6. Mass assignment sur `UserSerializer`
**Fichier :** `apps/accounts/serializers.py`

`is_active` est writable par tous les utilisateurs authentifiés.

**Actions :**
- Passer `is_active` en `read_only_fields`
- Séparer les serializers lecture / écriture si nécessaire

---

### 7. Upload de fichiers sans validation du contenu
**Fichier :** `apps/documents/views.py` (l. 155-201)

Seul le `content-type` fourni par le client est vérifié (falsifiable). Le contenu réel du fichier n'est pas validé.

**Actions :**
- Valider les magic bytes avec `python-magic`
- Whitelist des types autorisés (PDF, images uniquement ?)
- Imposer une taille maximale côté modèle
- Servir les fichiers avec `Content-Disposition: attachment`

---

### 8. Fichiers servis via `/media/` sans contrôle de permission (IDOR)
**Fichier :** `apps/documents/serializers.py` (l. 64-72)

L'URL `/media/<path>` est publique. Si un UUID est deviné, n'importe qui peut télécharger n'importe quel document.

**Actions :**
- Servir les fichiers via une vue avec contrôle de permission
- Utiliser des URLs signées avec expiration (S3 presigned URLs ou équivalent)
- Ajouter un log des téléchargements

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

### 11. Refresh token sans backoff ni logout propre
**Fichier :** `ui/src/lib/axios.ts` (l. 16-36)

En cas d'échec du refresh, pas de backoff et pas de logout explicite → comportement imprévisible.

**Actions :**
- Logout propre (clear tokens + redirect) si le refresh échoue
- Pas de retry infini

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
