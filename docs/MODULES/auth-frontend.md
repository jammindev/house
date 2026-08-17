# Module — auth-frontend

> Audit : 2026-04-28. Rôle : couche d'authentification côté React (login, JWT, refresh, ProtectedLayout, impersonation).

## État synthétique

- **Périmètre** : `LoginPage`, `ProtectedLayout`, `AuthProvider` + contexte React, intercepteur Axios JWT (request + refresh), gestion impersonation. Pas de store Zustand pour l'auth — c'est un Context React qui expose `user`, `login`, `logout`, `impersonate`, `stopImpersonation`.
- **Health** : stable fonctionnellement, **dette sécu connue** (JWT en `localStorage` → exposé XSS, voir issue #47).

## Composition

- `ui/src/features/auth/AuthShell.tsx` — la coquille des **cinq** pages publiques : marque, titre, carte, marges
- `ui/src/features/auth/LoginPage.tsx` — formulaire login
- `ui/src/components/ProtectedLayout.tsx` — garde route + applique theme/dark mode profil
- `ui/src/lib/auth/context.tsx` — `AuthProvider`, login/logout/impersonate/stop, `applyLocale`
- `ui/src/lib/auth/authContext.ts` — type `AuthUser` + Context
- `ui/src/lib/auth/useAuth.ts` — hook
- `ui/src/lib/axios.ts` — intercepteur request (Bearer) + 401 → refresh → retry, sinon purge tokens et redirige `/login`
- Stockage : `localStorage` (`access_token`, `refresh_token`, `_impersonator_tokens`, `lang`) + `localStorage.theme` / `color_theme` gérés par `ui/src/lib/theme.ts` — pas de cookies httpOnly
- Pas de fichier `ui/src/lib/api/auth.ts` dédié — l'auth passe par `api.post('/auth/token/')` direct dans le contexte

## Notes

- **Les cinq pages publiques passent par `AuthShell`** — connexion, configuration
  initiale, mot de passe oublié, réinitialisation, invitation. Elles
  réimplémentaient chacune leur coquille et avaient déjà divergé : deux portaient
  le bloc de marque recopié, trois n'en avaient aucun, une seule avait un `px-4`
  (les quatre autres collaient aux bords sur mobile). Personne n'arbitrait donc la
  hiérarchie, et « Connexion » était écrit plus gros que « Maisonnée » sur le seul
  écran qu'on voit sans compte. Deux règles à préserver, tenues par
  `AuthShell.test.tsx` : **la marque est écrite plus grand que le titre de page**,
  et **le mot-signe n'a qu'un domicile** — aucune page n'importe `Logo` ni ne
  réécrit « Maisonnée ». En revue, une page qui recopie la marque a exactement le
  même diff qu'une page qui la réutilise ; l'écart ne se lit que sur l'écran d'à
  côté, celui qu'on n'a pas ouvert. Issue #631.
- L'impersonation backend est sécurisée (audit log côté Django, endpoint users restreint aux staff).
- `parseJwtPayload` lit le claim `impersonated_by` directement depuis le JWT côté client — purement informatif, l'autorisation reste serveur.
- Le message "Chargement…" a été retiré de `ProtectedLayout` : le composant rend `null` pendant `isLoading` au lieu d'un texte hardcodé (`ui/src/components/ProtectedLayout.tsx:24`).
- Thème persisté en `localStorage` (`theme`, `color_theme`) séparément des tokens — le `logout()` ne supprime pas ces clés, le thème survit à la déconnexion.
