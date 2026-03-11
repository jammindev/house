# Architecture Hybride Django + React

> Canonical doc index: `docs/README.md`

Ce dépôt suit une approche **Django shell + React mini-SPA** :

1. Django gère les routes, l’auth, l’API REST, et rend des pages shell minimales.
2. Chaque page applicative est une mini-SPA React : titre, description, boutons d’action, et toute l’UI sont gérés par React.
3. Les assets React sont gérés par Vite et servis par Django (`django-vite`).

---

## Vue d’ensemble

### Côté Django

- Shell HTML par page via `ReactPageView` (`core/views.py`)
- API REST via DRF (`/api/...`)
- Auth session Django (pages + API)
- Props initiales sérialisées en JSON dans la page (`<script type="application/json">`)

### Côté React

- Source: `ui/src/`
- Build: `static/react/`
- Chargement dans les templates via tags `django_vite`
- Hydratation via `mountWithJsonScriptProps()` (`ui/src/lib/mount.tsx`)

---

## Pattern de page standard : mini-SPA

Chaque page applicative suit ce pattern :

### 1) Vue Django (`ReactPageView`)

`ReactPageView` (dans `core/views.py`) rend un template shell et passe des props JSON :

```python
class AppTasksView(ReactPageView):
    react_root_id = "tasks-root"
    props_script_id = "tasks-props"
    page_vite_asset = "src/pages/tasks/list.tsx"

    def get_props(self):
        return { ... }  # données initiales sérialisées en JSON
```

### 2) Template shell (`core/react_page.html`)

Django rend uniquement le point de montage React et les props :

```html
{% extends "base_app.html" %}
{% block content %}
<div id="{{ react_root_id }}"></div>
{{ react_props|json_script:props_script_id }}
{% endblock %}
{% block extra_js %}
    {% vite_asset page_vite_asset %}
{% endblock %}
```

### 3) Entry point Vite (`ui/src/pages/<app>/list.tsx`)

Monte le composant React dans le div avec les props Django :

```ts
onDomReady(() => {
  mountWithJsonScriptProps(‘tasks-root’, ‘tasks-props’, TasksPage);
});
```

### 4) Composant React (mini-SPA)

Le composant gère tout : titre, actions, état, UI.
Le composant `PageHeader` (`ui/src/components/PageHeader.tsx`) gère le titre de page et les boutons d’action :

```tsx
<PageHeader title={t(‘tasks.title’, { defaultValue: ‘Tasks’ })}>
  <button onClick={() => setNewTaskOpen(true)}>New task</button>
</PageHeader>
```

`PageHeader` met aussi à jour `document.title` via `useEffect`.

---

## Autres patterns présents

### Page Django classique

Route HTML rendue 100% côté Django (ex: login, onboarding).

### Web Components React

Pattern utilisé pour `ui-button` :

- composant React `ui/src/web-components/Button.tsx`
- wrapper Web Component `ui/src/web-components/createWebComponent.tsx`

```html
<ui-button variant="default" text="React Default"></ui-button>
```

---

## Arborescence utile

```text
.
├── templates/
│   ├── base_app.html              ← layout app (nav, sidebar)
│   └── core/react_page.html      ← shell mini-SPA
├── apps/
│   └── <app>/
│       ├── views_web.py           ← ReactPageView subclass + get_props()
│       └── react/                 ← composants React de l’app
├── ui/src/
│   ├── pages/<app>/list.tsx       ← entry points Vite (montage React)
│   ├── components/PageHeader.tsx  ← header de page partagé
│   └── lib/mount.tsx              ← utilitaire mountWithJsonScriptProps
└── static/react/                  ← build output
```

---

## Workflow développement

### Lancer le projet

```bash
# Terminal 1
python manage.py runserver

# Terminal 2
npm run dev
```

### Build production

```bash
npm run build
python manage.py collectstatic --noinput
```

---

## Ajouter une nouvelle page mini-SPA

1. Créer le composant React dans `apps/<app>/react/`.
2. Créer l’entry Vite dans `ui/src/pages/<app>/` (montage via `mountWithJsonScriptProps`).
3. Créer la vue Django (`ReactPageView`) avec `react_root_id`, `props_script_id`, `page_vite_asset`, et `get_props()`.
4. Ajouter `PageHeader` dans le composant React avec titre et boutons d’action.
5. Enregistrer la route Django dans `urls.py`.

---

## Pourquoi ce choix

- SSR rapide et robuste pour les pages métier
- Intégration progressive de React
- Déploiement simple (un service Django)
- Bonne base pour i18n/accessibilité

---

## Système de styles (CSS)

### Stack

- **Tailwind CSS v4** via `@tailwindcss/postcss` (PostCSS)
- **Pas de `tailwind.config.js`** — configuration inline via `@theme` dans `styles.css`
- **Vite** bundle le CSS via l'entrée `src/styles.css`

### Entrée principale

```
ui/src/styles.css          ← entrée Vite, @theme inline, imports
ui/src/styles/
  tokens.css                     ← :root CSS vars (shadcn/ui semantic tokens)
  themes.css                     ← 17 classes .theme-* (palettes primary/secondary/accent)
  components.css                 ← @layer base/components/utilities + classes composant
  tinymce.css                    ← overrides éditeur TinyMCE
```

### Livraison aux templates Django

`base.html` charge le CSS et les Web Components séparément :

```html
{% vite_asset 'src/styles.css' %}               {# CSS global de l'app #}
{% vite_asset 'src/web-components/Button.tsx' %} {# JS uniquement — le CSS est déjà chargé #}
```

En dev : Vite HMR injecte le CSS dynamiquement.
En prod (`npm run build`) : Vite génère `static/react/assets/styles-[hash].css` (~154 kB, ~24 kB gzippé), référencé via `manifest.json`.

Tous les templates héritent de `base.html` → tout le CSS est toujours disponible.

### Système de thèmes

17 thèmes disponibles. Appliquer une classe sur `<body>` :

```html
<body class="theme-house house-theme">   <!-- thème vert/maison -->
<body class="theme-purple">              <!-- thème violet -->
```

La classe `.theme-*` surcharge les variables `--color-primary-*`, `--color-secondary-*`, `--color-accent-*` (échelle 50–900).
La classe `.house-theme` applique `background-color` et `color` depuis ces variables.

### Variables CSS → Tailwind utilities

`@theme inline` dans `styles.css` relie les CSS vars aux utilities Tailwind :

```css
/* tokens.css définit --primary: 142 71% 45%; (HSL) */
/* styles.css @theme inline expose : */
--color-background: hsl(var(--background));
--color-primary-600: var(--color-primary-600);
```

Donc dans les templates et composants :

```html
class="bg-background text-foreground"     ← semantic tokens
class="bg-primary-600 text-primary-50"    ← palette du thème actif
class="rounded-md border-border"          ← radius + border token
```

### Classes composant utilitaires clés

| Classe | Usage |
|---|---|
| `.custom-card` | Card avec couleurs primaires du thème |
| `.semantic-card` | Card avec tokens shadcn/ui |
| `.form-label` / `.form-input` / `.form-error` | Formulaires |
| `.glass-panel` / `.bg-glass` / `.glass-panel-dark` | Glassmorphism |
| `.nav-link` / `.nav-link.active` | Liens de navigation |
| `.alert-info` / `.alert-warning` / `.alert-error` | Alertes |
| `.modal-overlay` / `.modal-content` | Modales |
| `.progress-bar` / `.progress-bar-accent` | Barres de progression |

### Règles IA pour le CSS

- Ne jamais modifier `tailwind.config.js` pour les couleurs — c'est `@theme inline` dans `styles.css` qui fait foi
- Ajouter de nouvelles classes composant dans `styles/components.css`
- Ajouter un nouveau thème dans `styles/themes.css` (copier un bloc existant)
- Modifier les tokens globaux (radius, dark mode, etc.) dans `styles/tokens.css`
- Ne pas utiliser `@apply` — utiliser `var(--color-primary-*)` ou `hsl(var(--primary))` directement
