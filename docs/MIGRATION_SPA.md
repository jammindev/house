# Migration vers une architecture SPA propre

## Contexte

**Stack actuelle :** Django hybride (rendu de pages avec mini-SPAs React par app)
**Stack cible :** Django REST API pure + React SPA + TanStack Query + JWT

**Bonne nouvelle : tout est déjà installé.**
- `@tanstack/react-query` v5 ✓
- `react-router-dom` v7 ✓
- `axios` ✓
- `zustand` ✓
- `djangorestframework_simplejwt` ✓

Il faut juste brancher tout ça.

---

## Vue d'ensemble des phases

1. **Backend — JWT auth**
2. **Frontend — Fondations (QueryClient + axios + Router)**
3. **Frontend — Auth flow**
4. **Frontend — Migration des features (pattern + exemple Tasks)**
5. **Nettoyage — Supprimer la couche hybride Django**

---

## Phase 1 — Backend : JWT Auth

### 1.1 Configurer simplejwt dans `config/settings/base.py`

```python
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,  # pas besoin de blacklist pour un side project
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",  # garder pour /admin/
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}
```

### 1.2 Ajouter les endpoints JWT dans `config/urls.py`

```python
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    # ... urls existantes ...

    # Auth JWT
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
]
```

### 1.3 Configurer CORS dans `config/settings/base.py`

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5174",  # Vite dev server
]
CORS_ALLOW_CREDENTIALS = True
```

En prod ajouter le domaine de l'app.

### 1.4 Ajouter le catch-all React Router dans `config/urls.py`

Django doit servir `index.html` pour toutes les URLs front qui ne sont pas `/api/` ou `/admin/`.

```python
from django.views.generic import TemplateView

# À la FIN de urlpatterns, après toutes les autres routes :
urlpatterns += [
    path("", TemplateView.as_view(template_name="index.html"), name="spa"),
    re_path(r"^(?!api/|admin/|static/|media/).*$",
            TemplateView.as_view(template_name="index.html"),
            name="spa_catchall"),
]
```

### 1.5 Créer `templates/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>House</title>
  {% load django_vite %}
  {% vite_asset 'src/main.tsx' %}
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

---

## Phase 2 — Frontend : Fondations

### 2.1 Restructurer `ui/src/`

```
ui/src/
  features/           # ← nouveau, par domaine métier
    tasks/
    zones/
    interactions/
    projects/
    equipment/
    stock/
    documents/
    directory/
    electricity/
    photos/
    settings/
  lib/
    api/              # fonctions fetch existantes (garder, juste nettoyer)
    axios.ts          # ← nouveau, instance axios configurée
    queryClient.ts    # ← nouveau, QueryClient configuré
    auth/
      context.tsx     # ← nouveau, AuthContext
      hooks.ts        # ← nouveau, useAuth
  components/         # composants partagés (garder)
  design-system/      # (garder)
  router.tsx          # ← nouveau, React Router config
  main.tsx            # ← nouveau, entry point unique
  styles.css          # (garder)
```

### 2.2 Créer `ui/src/lib/axios.ts`

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Injecter le token sur chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh automatique sur 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) throw new Error('No refresh token');
        const { data } = await axios.post('/api/auth/token/refresh/', { refresh });
        localStorage.setItem('access_token', data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### 2.3 Créer `ui/src/lib/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### 2.4 Mettre à jour Vite pour un seul entry point

Dans `ui/vite.config.ts`, remplacer la section `rollupOptions.input` par :

```typescript
rollupOptions: {
  input: {
    main: resolve(__dirname, 'src/main.tsx'),
    styles: resolve(__dirname, 'src/styles.css'),
  },
  output: {
    entryFileNames: 'assets/[name]-[hash].js',
    chunkFileNames: 'assets/[name]-[hash].js',
    assetFileNames: 'assets/[name]-[hash].[ext]',
  },
},
```

### 2.5 Créer `ui/src/router.tsx`

```tsx
import { createBrowserRouter } from 'react-router-dom';
import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './features/auth/LoginPage';

// Pages (importer au fur et à mesure de la migration)
import TasksPage from './features/tasks/TasksPage';
import ZonesPage from './features/zones/ZonesPage';
// ...

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/app',
    element: <ProtectedLayout />,
    children: [
      { path: 'tasks', element: <TasksPage /> },
      { path: 'zones', element: <ZonesPage /> },
      { path: 'zones/:id', element: <ZoneDetailPage /> },
      { path: 'interactions', element: <InteractionsPage /> },
      { path: 'interactions/new', element: <InteractionNewPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'equipment/:id', element: <EquipmentDetailPage /> },
      { path: 'stock', element: <StockPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'directory', element: <DirectoryPage /> },
      { path: 'photos', element: <PhotosPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
    ],
  },
]);
```

### 2.6 Créer `ui/src/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { router } from './router';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './lib/auth/context';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

## Phase 3 — Frontend : Auth Flow

### 3.1 Créer `ui/src/lib/auth/context.tsx`

```tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../axios';

interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Vérifier si un token valide existe au démarrage
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.get('/accounts/me/')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/token/', { email, password });
    // Note : simplejwt utilise 'username' par défaut, adapter si ton User model utilise email
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    const me = await api.get('/accounts/me/');
    setUser(me.data);
  }

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

### 3.2 Ajouter un endpoint `/api/accounts/me/`

Dans `apps/accounts/views.py` (ou `urls.py`), exposer l'utilisateur courant :

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def me(request):
    user = request.user
    return Response({
        'id': str(user.id),
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
    })
```

```python
# Dans accounts/urls.py
path("me/", me, name="me"),
```

### 3.3 Créer `ui/src/components/ProtectedLayout.tsx`

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth/context';
import AppShell from './AppShell'; // ton layout sidebar existant

export default function ProtectedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="flex h-screen items-center justify-center">
    <span className="text-muted-foreground">Chargement…</span>
  </div>;

  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
```

### 3.4 Créer `ui/src/features/auth/LoginPage.tsx`

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/context';
import { Button } from '../../design-system/button';
import { Input } from '../../design-system/input';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Déjà connecté → rediriger
  if (user) {
    navigate('/app/dashboard');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/app/dashboard');
    } catch {
      setError('Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Connexion</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </div>
  );
}
```

---

## Phase 4 — Migration des features

### Pattern à suivre pour chaque feature

Chaque feature suit la même structure :

```
ui/src/features/<nom>/
  api.ts      # query keys + fonctions fetch (wrappent les fonctions existantes dans lib/api/)
  hooks.ts    # useQuery + useMutation
  <Page>.tsx  # composant page (déplacé depuis apps/<nom>/react/)
  <Card>.tsx  # autres composants
```

### Template `api.ts`

```typescript
// ui/src/features/tasks/api.ts
import { api } from '../../lib/axios';
import type { Task } from '../../lib/api/tasks'; // réutiliser les types existants

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters?: Record<string, unknown>) => [...taskKeys.all, 'list', filters] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};

export async function fetchTasks(filters?: { status?: string }) {
  const { data } = await api.get('/tasks/tasks/', { params: filters });
  return data.results as Task[];
}

export async function createTask(payload: unknown) {
  const { data } = await api.post('/tasks/tasks/', payload);
  return data as Task;
}

export async function updateTask(id: string, payload: unknown) {
  const { data } = await api.patch(`/tasks/tasks/${id}/`, payload);
  return data as Task;
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/tasks/${id}/`);
}
```

### Template `hooks.ts`

```typescript
// ui/src/features/tasks/hooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys, fetchTasks, createTask, updateTask, deleteTask } from './api';

export function useTasks(filters?: { status?: string }) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => fetchTasks(filters),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) => updateTask(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
```

### Exemple concret : `TasksPage.tsx` migré

```tsx
// ui/src/features/tasks/TasksPage.tsx
import { useTasks, useUpdateTask, useDeleteTask } from './hooks';
import { useDeleteWithUndo } from '../../lib/useDeleteWithUndo';
// ... autres imports

export default function TasksPage() {
  const { t } = useTranslation();
  const { data: tasks = [], isLoading, error } = useTasks();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  // Plus de useEffect, plus de loadTasks, plus de setLoading manuel

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('tasks.deleted'),
    onDelete: (id) => deleteTask.mutateAsync(id),
  });

  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    // Update optimiste via TanStack Query
    await updateTask.mutateAsync({ id: taskId, payload: { status: newStatus } });
  }, [updateTask]);

  // ... reste du JSX identique, sauf que `loading` → `isLoading`, `error` → `error?.message`
}
```

### Ordre de migration recommandé

Migrer dans cet ordre (du plus simple au plus complexe) :

1. `tasks` — déjà bien isolé
2. `zones`
3. `interactions`
4. `projects`
5. `equipment`
6. `stock`
7. `documents`
8. `directory` (contacts + structures)
9. `electricity`
10. `photos`
11. `app_settings`

Pour chaque feature :
1. Créer `features/<nom>/api.ts` (wrapper axios autour des fonctions existantes)
2. Créer `features/<nom>/hooks.ts`
3. Déplacer les composants depuis `apps/<nom>/react/` vers `features/<nom>/`
4. Remplacer les `useEffect` + `useState` fetch par les hooks TanStack Query
5. Ajouter la route dans `router.tsx`
6. Tester

---

## Phase 5 — Nettoyage de la couche hybride

Une fois toutes les features migrées et testées :

### 5.1 Supprimer les fichiers par app

Pour chaque app Django, supprimer :
- `apps/<nom>/views_web.py`
- `apps/<nom>/web_urls.py`
- `apps/<nom>/templates/` (si existant)

### 5.2 Nettoyer `config/urls.py`

Supprimer tous les `path("app/...", include("*.web_urls"))` et ne garder que :
- `/api/...` — endpoints API
- `/admin/` — Django admin
- `/` + catch-all — servir `index.html`

```python
urlpatterns = [
    path("admin/", admin.site.urls),

    # API
    path("api/auth/", ...),
    path("api/accounts/", include("accounts.urls")),
    path("api/households/", include("households.urls")),
    path("api/zones/", include("zones.urls")),
    path("api/documents/", include("documents.urls")),
    path("api/interactions/", include("interactions.urls")),
    path("api/contacts/", include("directory.urls")),
    path("api/structures/", include("directory.structures_urls")),
    path("api/tags/", include("tags.urls")),
    path("api/equipment/", include("equipment.urls")),
    path("api/stock/", include("stock.urls")),
    path("api/insurance/", include("insurance.urls")),
    path("api/electricity/", include("electricity.urls")),
    path("api/projects/", include("projects.urls")),
    path("api/tasks/", include("tasks.urls")),
    path("api/notifications/", include("notifications.urls")),

    # SPA catch-all
    re_path(r"^(?!api/|admin/|static/|media/).*$",
            TemplateView.as_view(template_name="index.html")),
]
```

### 5.3 Supprimer `django-vite` et le code de rendu hybride

```python
# Retirer de INSTALLED_APPS :
# "django_vite",

# Retirer de settings :
# DJANGO_VITE_* configs
```

Vite build produit des assets statiques servis par Whitenoise — plus besoin de l'intégration Django Vite.

### 5.4 Supprimer les classes hybrides devenues inutiles

- `apps/core/views.py` — `ReactPageView`, `ReactPageMixin`
- `apps/core/context_processors.py` — si uniquement utilisé pour le rendu hybride

---

## Notes importantes

### `ActiveHouseholdMiddleware` — à garder

Le middleware reste intact, il continue de scoper toutes les requêtes API automatiquement.

### Switcher de household

L'endpoint de switch household (`/api/households/switch/` ou équivalent) reste. Après le switch, invalider tout le cache TanStack Query :

```typescript
import { useQueryClient } from '@tanstack/react-query';

function useSwitchHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (householdId: string) => api.post('/households/switch/', { household_id: householdId }),
    onSuccess: () => qc.invalidateQueries(), // invalide TOUT le cache
  });
}
```

### simplejwt avec email comme username

Par défaut simplejwt attend `username`. Si ton modèle User utilise `email` comme identifiant :

```python
# Dans settings
SIMPLE_JWT = {
    # ...
    "USER_AUTHENTICATION_RULE": "rest_framework_simplejwt.authentication.default_user_authentication_rule",
}
```

Et créer un serializer custom :

```python
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
```

Utiliser `EmailTokenObtainPairView` dans `urls.py` à la place de `TokenObtainPairView`.

### i18n

React Router SPA + i18next — le changement de langue se fait via `i18n.changeLanguage()` côté client, plus via les URLs Django. Le middleware `UserLocaleMiddleware` peut rester pour les appels API (il s'assure que les erreurs DRF sont dans la bonne langue si tu en as besoin).

---

## Checklist de fin de session

- [ ] simplejwt configuré dans settings
- [ ] endpoints `/api/auth/token/` et `/api/auth/token/refresh/` fonctionnels
- [ ] `/api/accounts/me/` retourne l'utilisateur courant
- [ ] `templates/index.html` créé
- [ ] catch-all URL configurée
- [ ] `ui/src/lib/axios.ts` créé avec intercepteurs
- [ ] `ui/src/lib/queryClient.ts` créé
- [ ] `ui/src/lib/auth/context.tsx` créé
- [ ] `ui/src/main.tsx` créé (entry point unique)
- [ ] `ui/vite.config.ts` — rollup réduit à `main` + `styles`
- [ ] Login page fonctionnelle
- [ ] ProtectedLayout + redirect `/login`
- [ ] Au moins une feature migrée (Tasks recommandé)
- [ ] Django admin toujours accessible
