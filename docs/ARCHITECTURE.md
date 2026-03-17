# Architecture

## Stack

- **Backend** : Django 5 + DRF + PostgreSQL
- **Frontend** : React 19 + TypeScript + Vite
- **Data fetching** : TanStack Query v5
- **Routing** : React Router v7
- **Auth** : JWT via djangorestframework-simplejwt
- **CSS** : Tailwind CSS v4

## Structure backend

```
apps/<nom>/
  models.py
  views.py       # ViewSets DRF uniquement
  serializers.py
  urls.py
  tests/
```

Pas de `views_web.py` ni `web_urls.py` — l'architecture hybride a été supprimée.

## Structure frontend

```
ui/src/
  features/<nom>/
    api.ts        # queryKeys + fonctions fetch axios
    hooks.ts      # useQuery / useMutation
    <Page>.tsx    # composants page
  lib/
    axios.ts      # instance axios + intercepteurs JWT
    queryClient.ts
    auth/
      context.tsx
  components/     # composants partagés (AppShell, Sidebar, PageLayout…)
  design-system/
  router.tsx
  main.tsx
```

## Conventions data fetching

- Toujours passer par les hooks TanStack Query (`useQuery`, `useMutation`)
- Ne jamais faire de `fetch` direct dans un composant React
- Pattern queryKeys :
  ```typescript
  export const fooKeys = {
    all: ['foo'] as const,
    list: (filters?) => [...fooKeys.all, 'list', filters] as const,
    detail: (id: string) => [...fooKeys.all, 'detail', id] as const,
  };
  ```

## Auth

JWT access token stocké en `localStorage` (`access_token`), refresh token en `localStorage` (`refresh_token`).

L'intercepteur axios gère le refresh automatique sur 401 (voir `lib/axios.ts`).

Endpoints :
- `POST /api/auth/token/` — obtenir les tokens (email + password)
- `POST /api/auth/token/refresh/` — renouveler l'access token
- `GET /api/accounts/me/` — utilisateur courant

## Household scoping

Le middleware `ActiveHouseholdMiddleware` scope automatiquement toutes les requêtes API via `request.household`. Les composants React ne passent **jamais** de `householdId` dans les paramètres de requête.

```typescript
// ✅ Correct
fetch('/api/tasks/tasks/')

// ❌ Incorrect
fetch(`/api/households/${householdId}/tasks/`)
```

## Composants partagés

| Composant | Usage |
|-----------|-------|
| `AppShell` | Layout principal (sidebar + main) |
| `Sidebar` | Navigation latérale responsive |
| `PageLayout` | Wrapper de page (sticky header, titre, actions, burger mobile) |
| `ListSkeleton` | Skeleton de liste pendant le chargement |
| `ConfirmDialog` | Dialog de confirmation de suppression |
| `HouseholdSwitcher` | Sélecteur de household dans la sidebar |

## Routes SPA

Toutes les routes sont définies dans `ui/src/router.tsx`.
Les routes `/app/*` sont protégées par `ProtectedLayout` (redirige vers `/login` si non authentifié).
