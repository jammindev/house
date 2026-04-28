# Module — auth-frontend

> Audit : 2026-04-28. Rôle : couche d'authentification côté React (login, JWT, refresh, ProtectedLayout, impersonation).

## État synthétique

- **Périmètre** : `LoginPage`, `ProtectedLayout`, `AuthProvider` + contexte React, intercepteur Axios JWT (request + refresh), gestion impersonation. Pas de store Zustand pour l'auth — c'est un Context React qui expose `user`, `login`, `logout`, `impersonate`, `stopImpersonation`.
- **Health** : stable fonctionnellement, **dette sécu connue** (JWT en `localStorage` → exposé XSS, voir `docs/SECURITY_REVIEW.md` §2).

## Composition

- `ui/src/features/auth/LoginPage.tsx` — formulaire login
- `ui/src/components/ProtectedLayout.tsx` — garde route + applique theme/dark mode profil
- `ui/src/lib/auth/context.tsx` — `AuthProvider`, login/logout/impersonate/stop, `applyLocale`
- `ui/src/lib/auth/authContext.ts` — type `AuthUser` + Context
- `ui/src/lib/auth/useAuth.ts` — hook
- `ui/src/lib/axios.ts` — intercepteur request (Bearer) + 401 → refresh → retry, sinon purge tokens et redirige `/login`
- Stockage : `localStorage` (`access_token`, `refresh_token`, `_impersonator_tokens`, `lang`) + `localStorage.theme` / `color_theme` gérés par `ui/src/lib/theme.ts` — pas de cookies httpOnly
- Pas de fichier `ui/src/lib/api/auth.ts` dédié — l'auth passe par `api.post('/auth/token/')` direct dans le contexte

## À corriger (urgent)

- [ ] LoginPage — tous les libellés sont hardcodés en français (`"Connexion"`, `"Email ou mot de passe incorrect."`, `"Se connecter"`) — *source : `ui/src/features/auth/LoginPage.tsx` l. 28, 37, 42, viole la règle "jamais de chaînes hardcodées" (CLAUDE.md) — #61*
- [ ] Couleur hardcodée `text-red-600` pour l'erreur de login — *source : `ui/src/features/auth/LoginPage.tsx` l. 38, viole la règle "tokens CSS uniquement" (CLAUDE.md)*
- [ ] `LoginPage` appelle `navigate()` pendant le render quand `user` est défini — *source : `ui/src/features/auth/LoginPage.tsx` l. 15–16, devrait être un `<Navigate />` déclaratif*

## À faire (backlog)

- [ ] Migrer JWT `localStorage` → cookies `httpOnly; Secure; SameSite=Strict` — *source : #47, `docs/SECURITY_REVIEW.md` §2*
- [ ] Audit log des actions d'impersonation côté front (déclencher / arrêter) — *source : #48*
- [ ] 2FA / TOTP avant impersonation — *source : #49*
- [ ] Page d'inscription (`SignupPage`) — aucune page dédiée dans `ui/src/features/auth/` — *source : #59*
- [ ] Page de réinitialisation de mot de passe (frontend) — *source : #62*
- [ ] Stocker `_impersonator_tokens` côté serveur (session courte durée) plutôt qu'en clair dans `localStorage` — *source : `docs/SECURITY_REVIEW.md` §2 "Reste à faire"*

## À améliorer

- [ ] Extraire un fichier `ui/src/lib/api/auth.ts` (login, refresh, me, impersonate) pour aligner sur le pattern des autres apps et préparer le futur partage avec mobile — *source : `docs/ARCHITECTURE_AUDIT_2026_03.md` "Frontend feature modules"*
- [ ] Remplacer `useMe` (déprécié) par `useCurrentUser` dans `ProtectedLayout.tsx` — *source : `ui/src/components/ProtectedLayout.tsx:10`, `ui/src/features/settings/hooks.ts:48-49`*
- [ ] Ajouter un fallback gracieux quand `/accounts/me/` échoue après login (actuellement le user reste `null` sans message)
- [ ] Tester E2E le flow refresh token (interception 401 → refresh → retry de la requête originale)

## Notes

- L'impersonation backend est sécurisée (audit log côté Django, endpoint users restreint aux staff — voir `docs/SECURITY_REVIEW.md` §3, §4 résolus).
- `parseJwtPayload` lit le claim `impersonated_by` directement depuis le JWT côté client — purement informatif, l'autorisation reste serveur.
- Le message "Chargement…" a été retiré de `ProtectedLayout` : le composant rend `null` pendant `isLoading` au lieu d'un texte hardcodé (`ui/src/components/ProtectedLayout.tsx:24`).
- Thème persisté en `localStorage` (`theme`, `color_theme`) séparément des tokens — le `logout()` ne supprime pas ces clés, le thème survit à la déconnexion.
