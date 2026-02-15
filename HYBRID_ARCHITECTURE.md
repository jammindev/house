# Architecture Hybride Django + React

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

- Source: `frontend/src/`
- Build: `static/react/`
- Chargement dans les templates via tags `django_vite`

---

## Patterns hybrides présents

### 1) Page Django classique

Route HTML rendue 100% côté Django (ex: login/dashboard).

### 2) Django + Web Components React

Pattern utilisé pour `ui-button`:

- composant React `frontend/src/web-components/Button.tsx`
- wrapper Web Component `frontend/src/web-components/createWebComponent.tsx`
- usage direct dans template (`templates/test_components.html`)

Exemple:

```html
<ui-button variant="default" text="React Default"></ui-button>
```

### 3) Hydratation ciblée (prévu / partiellement utilisé)

Pattern `mountComponent(elementId, Component)` disponible dans:

- `frontend/src/lib/mount.tsx`

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
├── frontend/
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
python manage.py runserver 8000

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
