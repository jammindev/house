# Architecture Hybride Django + React

Ce projet utilise une architecture **Django-first** avec des composants React intégrés sur les zones complexes.

## Principe

1. **Django génère les pages HTML** (SSR rapide, SEO, accessibilité)
2. **React s'hydrate sur des zones spécifiques** (interactivité riche où nécessaire)

## Structure

```
house/
└── house/
    ├── manage.py
    ├── config/              # Django settings
    ├── accounts/            # Django apps
    ├── templates/           # Templates Django (.html)
    │   ├── base.html       # Layout de base
    │   └── dashboard_example.html  # Exemple intégration React
    ├── static/              # Fichiers statiques compilés
    │   └── react/          # Composants React buildés (par Vite)
    └── frontend/            # Sources React (développement)
        ├── src/
        │   ├── components/ # Composants React exportables
        │   └── lib/
        │       └── mount.tsx  # Utilitaire de montage
        └── vite.config.ts  # Build en mode library
```

## Workflow de développement

### 1. Développer un composant React

```tsx
// house/frontend/src/components/MyComponent.tsx
export default function MyComponent({ userId }: { userId: number }) {
  return <div>Hello user {userId}!</div>;
}
```

### 2. Ajouter au build Vite

```ts
// house/frontend/vite.config.ts
lib: {
  entry: {
    'MyComponent': resolve(__dirname, 'src/components/MyComponent.tsx'),
  }
}
```

### 3. Utiliser dans un template Django

```django
{% extends "base.html" %}
{% load static %}

{% block content %}
  <h1>Ma page Django</h1>
  <p>Contenu statique généré par Django...</p>
  
  <!-- Zone avec React -->
  <div id="my-component" data-props='{"userId": {{ user.id }}}'></div>
{% endblock %}

{% block extra_js %}
<script type="module">
  import('{% static "react/MyComponent.js" %}')
    .then(module => {
      window.mountReactComponent('my-component', module.default);
    });
</script>
{% endblock %}
```

## Commandes

### Développement

```bash
# Terminal 1 - Django
cd house && python manage.py runserver

# Terminal 2 - React (watch mode avec rebuild auto)
cd house/frontend && npm run dev
```

### Build production

```bash
# 1. Build des composants React
cd house/frontend && npm run build
# → Génère house/static/react/*.js

# 2. Collecte des static files Django
cd house && python manage.py collectstatic
# → Copie vers house/staticfiles/

# 3. Déployer
python manage.py runserver  # Ou gunicorn en prod
```

## Avantages de cette approche

✅ **Performance** : Pages Django servies rapidement (SSR)  
✅ **SEO** : Contenu HTML indexable par défaut  
✅ **Progressive enhancement** : Fonctionne sans JS (fallback)  
✅ **Flexibilité** : React uniquement où c'est utile  
✅ **Simplicité déploiement** : Un seul serveur Django  
✅ **Pas de CORS** : Tout sur le même domaine

## Exemples

- **Page liste simple** → 100% Django template
- **Formulaire de recherche avec filtres** → React component
- **Dashboard avec graphiques** → React + Chart.js
- **Authentification** → Django templates classiques
- **Éditeur de contenu riche** → React (TipTap, Slate)

## Migration progressive

Commencez avec Django partout, puis ajoutez React zone par zone :

1. Page simple → Django template
2. Zone devient complexe → Ajouter `<div id="react-zone">`
3. Monter composant React dedans
4. Garder fallback HTML pour no-JS
