# Research: Settings Migration

## Decision 1 — Avatar Storage

**Decision**: Utiliser `MEDIA_ROOT` / `MEDIA_URL` Django avec un champ `avatar` dédié sur le modèle `User` (FileField), en conservant `avatar_url` comme propriété calculée (URL publique du fichier). Si `MEDIA_ROOT` n'est pas configuré dans le projet, l'ajouter dans `config/settings/base.py`.

**Rationale**: Le projet n'a pas Supabase Storage. Django dispose d'un système de gestion des fichiers media natif. Garder `avatar_url` comme CharField URL permet la compatibilité avec l'existant; le nouveau champ `avatar` (FileField) porte la logique d'upload.

**Alternatives considered**:
- Stocker l'URL externe dans `avatar_url` sans upload Django : impraticable sans Supabase ou CDN configuré.
- Utiliser Base64 en DB : exclu — performances insuffisantes pour les images.
- ImageField sur User : identique à FileField avec validation image intégrée — retenu (utiliser `ImageField` avec `upload_to='avatars/'`).

**Impact**: Ajouter `MEDIA_ROOT = BASE_DIR / "media"` et `MEDIA_URL = "/media/"` dans `config/settings/base.py`. Ajouter la route media dans `config/urls.py` en dev. Ajouter la migration `avatar` sur `User`.

---

## Decision 2 — Champ `theme` sur User

**Decision**: Ajouter `theme = models.CharField(max_length=20, choices=[('light','Light'),('dark','Dark'),('system','System')], default='system', blank=True)` au modèle `accounts.User`.

**Rationale**: Le thème est une préférence utilisateur persistée. La solution la plus simple est de le stocker directement sur le modèle User existant, comme `locale` l'est déjà. Pas de table intermédiaire nécessaire.

**Alternatives considered**:
- localStorage uniquement (côté React) : ne persiste pas entre devices.
- Table `UserPreference` distincte : surdimensionné pour 1-2 préférences.

**Impact**: 1 champ ajouté, 1 migration, 1 clé supplémentaire dans `UserSerializer`.

---

## Decision 3 — Endpoint change-password

**Decision**: Ajouter une action `@action(detail=False, methods=['post'], url_path='me/change-password')` sur `UserViewSet`, acceptant `new_password` + `confirm_password`, validant côté serveur la correspondance et le minimum de complexité (≥ 8 caractères).

**Rationale**: Le `UserSerializer.update()` accepte déjà `password` via `PATCH /api/accounts/users/{id}/`, mais exposer la mise à jour de mot de passe via le PATCH général est risqué (co-location avec d'autres champs sensibles). Un endpoint dédié est plus explicite et plus testable.

**Alternatives considered**:
- Utiliser directement `PATCH /api/accounts/users/me/` avec `password` : possible mais moins sécurisé (pas de confirmation de MDP).
- Django `PasswordChangeForm` via un view HTML : cassé le pattern mini-SPA React.

**Impact**: 1 nouvelle action sur `UserViewSet`. Pas de nouveau modèle.

---

## Decision 4 — Endpoint `me` unifié

**Decision**: Ajouter une action `me` sur `UserViewSet` qui supporte `GET` et `PATCH` (l'action `me` actuelle ne supporte que GET). Le `PATCH` met à jour `display_name`, `locale`, `theme`.

**Rationale**: Évite de coder en dur l'`id` utilisateur côté React. L'URL `/api/accounts/users/me/` est plus lisible et sécurisée que `/api/accounts/users/{uuid}/`.

**Alternatives considered**:
- Utiliser `/api/accounts/users/{id}/` depuis React : nécessite de transmettre l'UUID utilisateur via SSR props, couplage inutile.

**Impact**: Modifier l'action `me` pour accepter `PATCH` en plus de `GET`.

---

## Decision 5 — Données SSR initiales (no loading flicker)

**Decision**: Le view Django `app_settings_view` sérialise l'utilisateur courant et ses households en JSON via `UserSerializer` et `HouseholdSerializer`, puis les passe au template via `json_script` (balise Django securisée). React lit ces données depuis le DOM avant tout appel API.

**Rationale**: Évite un `useEffect` + spinner au premier rendu. Le pattern est déjà utilisé pour d'autres mini-SPAs (voir `interactions`, `electricity`).

**Alternatives considered**:
- API call au montage uniquement (pas de SSR props) : acceptable mais ajoute un flash de loading.
- GraphQL / état global : hors scope.

**Impact**: `views_web.py` enrichi avec `UserSerializer(request.user).data` et la liste des households. Le template passe ces données via `json_script`.

---

## Decision 6 — MFA / TOTP

**Decision**: **Hors scope**. La migration ne porte pas le `MFASetup` component du legacy. Le projet Django n'a pas de MFA/TOTP configuré. Une feature dédiée sera nécessaire si souhaité.

**Rationale**: Le legacy `MFASetup` repose entièrement sur Supabase Auth MFA API. La réécriture complète en Django TOTP est une feature autonome non demandée.

---

## Decision 7 — Compression d'image côté client

**Decision**: Retirer la compression d'image (`compressFileForUpload` du legacy). Validation simple : type image + taille max 2 MB côté frontend, validation MIME + taille côté Django.

**Rationale**: Le legacy utilisait une lib de compression Next.js spécifique. Dans le nouveau contexte, la validation de base (type + taille) est suffisante pour un MVP.

**Alternatives considered**:
- Réimplémenter la compression avec `browser-image-compression` : possible mais hors scope MVP.
