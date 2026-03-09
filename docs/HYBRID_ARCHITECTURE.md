# Architecture Hybride Django + React

> Canonical doc index: `docs/README.md`

Ce dépôt suit une approche **Django-first**:

1. Django rend les pages et les routes principales.
2. React est ajouté uniquement pour les zones UI riches.
3. Les assets React sont gérés par Vite et servis par Django (`django-vite`).

---

## Vue d’ensemble

### Côté Django

- Rendu serveur via templates (`templates/`)
- API REST via DRF (`/api/...`)
- Auth session Django (pages + API)

### Côté React

- Source: `ui/src/`
- Build: `static/react/`
- Chargement dans les templates via tags `django_vite`

---

## Patterns hybrides présents

### 1) Page Django classique

Route HTML rendue 100% côté Django (ex: login/dashboard).

### 2) Django + Web Components React

Pattern utilisé pour `ui-button`:

- composant React `ui/src/web-components/Button.tsx`
- wrapper Web Component `ui/src/web-components/createWebComponent.tsx`
- usage direct dans template (`templates/test_components.html`)

Exemple:

```html
<ui-button variant="default" text="React Default"></ui-button>
```

### 3) Hydratation ciblée (prévu / partiellement utilisé)

Pattern `mountComponent(elementId, Component)` disponible dans:

- `ui/src/lib/mount.tsx`

Il permet de monter un composant React dans une div Django avec `data-props`.

---

## Arborescence utile

```text
.
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── base_components.html
│   └── test_components.html
├── ui/
│   ├── vite.config.ts
│   └── src/
│       ├── web-components/
│       │   ├── createWebComponent.tsx
│       │   └── Button.tsx
│       └── lib/mount.tsx
└── static/react/   # build output
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

## Ajouter une nouvelle zone React dans un template Django

1. Créer le composant React.
2. L’exposer via Vite (entry `rollupOptions.input` si nécessaire).
3. Charger l’asset côté template avec `django_vite`.
4. Prévoir un fallback HTML (`noscript`) quand utile.

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
