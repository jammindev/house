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

## Notes

- L'impersonation backend est sécurisée (audit log côté Django, endpoint users restreint aux staff — voir `docs/SECURITY_REVIEW.md` §3, §4 résolus).
- `parseJwtPayload` lit le claim `impersonated_by` directement depuis le JWT côté client — purement informatif, l'autorisation reste serveur.
- Le message "Chargement…" a été retiré de `ProtectedLayout` : le composant rend `null` pendant `isLoading` au lieu d'un texte hardcodé (`ui/src/components/ProtectedLayout.tsx:24`).
- Thème persisté en `localStorage` (`theme`, `color_theme`) séparément des tokens — le `logout()` ne supprime pas ces clés, le thème survit à la déconnexion.
