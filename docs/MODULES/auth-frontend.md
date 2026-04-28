# Module — auth-frontend

> Audit : 2026-04-27. Rôle : couche d'authentification côté React (login, JWT, refresh, ProtectedLayout, impersonation).

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
- Stockage : `localStorage` (`access_token`, `refresh_token`, `_impersonator_tokens`, `lang`, `theme`) — pas de cookies httpOnly
- Pas de fichier `ui/src/lib/api/auth.ts` dédié — l'auth passe par `api.post('/auth/token/')` direct dans le contexte

## À corriger (urgent)

- [ ] LoginPage — tous les libellés sont hardcodés en français (`"Connexion"`, `"Email ou mot de passe incorrect."`, `"Se connecter"`) — *source : `ui/src/features/auth/LoginPage.tsx` l. 37–43, viole la règle "jamais de chaînes hardcodées" (CLAUDE.md global)*
- [ ] `ProtectedLayout` — message "Chargement…" hardcodé en français — *source : `ui/src/components/ProtectedLayout.tsx` l. 21*
- [ ] Couleur hardcodée `text-red-600` pour l'erreur de login — *source : `ui/src/features/auth/LoginPage.tsx` l. 38, viole la règle "tokens CSS uniquement" (CLAUDE.md projet)*
- [ ] `LoginPage` appelle `navigate()` pendant le render quand `user` est défini — *source : `ui/src/features/auth/LoginPage.tsx` l. 15–18, devrait être un `useEffect` ou `<Navigate />`*

## À faire (backlog)

- [ ] [SEC-01] Migrer JWT `localStorage` → cookies `httpOnly; Secure; SameSite=Strict` — *source : `GITHUB_ISSUES_BACKLOG.md` SEC-01, `docs/SECURITY_REVIEW.md` §2*
- [ ] [SEC-02] Audit log des actions d'impersonation côté front (déclencher / arrêter) — *source : `GITHUB_ISSUES_BACKLOG.md` SEC-02*
- [ ] [SEC-03] 2FA / TOTP avant impersonation — *source : `GITHUB_ISSUES_BACKLOG.md` SEC-03*
- [ ] Stocker `_impersonator_tokens` côté serveur (session courte durée) plutôt qu'en clair dans `localStorage` — *source : `docs/SECURITY_REVIEW.md` §2 "Reste à faire"*

## À améliorer

- [ ] Extraire un fichier `ui/src/lib/api/auth.ts` (login, refresh, me, impersonate) pour aligner sur le pattern des autres apps et préparer le futur partage avec mobile — *source : `docs/ARCHITECTURE_AUDIT_2026_03.md` "Frontend feature modules"*
- [ ] Ajouter un fallback gracieux quand `/accounts/me/` échoue après login (actuellement le user reste `null` sans message)
- [ ] Tester E2E le flow refresh token (interception 401 → refresh → retry de la requête originale)

## Notes

- L'impersonation backend est sécurisée (audit log côté Django, endpoint users restreint aux staff — voir `docs/SECURITY_REVIEW.md` §3, §4 résolus).
- `parseJwtPayload` lit le claim `impersonated_by` directement depuis le JWT côté client — purement informatif, l'autorisation reste serveur.
