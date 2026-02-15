# Système de Design Tokens

Ce document explique l'organisation des tokens CSS et comment utiliser le système de thèmes.

## 📁 Architecture

```
src/
├── app/
│   └── globals.css          # Tokens shadcn/ui + utilities
└── styles/
    ├── themes.css           # Thèmes personnalisés (couleurs)
    └── README.md           # Ce fichier
```

## 🎨 Hiérarchie des Tokens

### 1. Tokens de Thème (themes.css)
Variables de couleurs spécifiques à chaque thème :
```css
--color-primary-50 à --color-primary-900
--color-secondary-50 à --color-secondary-900
--color-accent-50 à --color-accent-900
--ring (focus ring HSL)
```

**Thèmes disponibles :**
- `.theme-blue` - Bleu ciel (défaut)
- `.theme-sass` - Rose/Pink
- `.theme-sass2` - Vert sauge
- `.theme-sass3` - Bleu océan
- `.theme-house` - Evergreen (vert maison)
- `.theme-purple` - Violet
- `.theme-green` - Vert vif

### 2. Tokens shadcn/ui (globals.css)
Variables sémantiques pour les composants UI :
```css
--background, --foreground
--card, --card-foreground
--primary, --primary-foreground
--secondary, --secondary-foreground
--muted, --muted-foreground
--accent, --accent-foreground
--destructive, --destructive-foreground
--border, --input, --ring
```

## 🔄 Comment ça fonctionne

1. **Tailwind** est chargé en premier
2. **themes.css** définit les couleurs via classes `.theme-*`
3. **shadcn tokens** utilisent ces couleurs et ajoutent la couche sémantique
4. **Tailwind config** expose tout via les classes utilitaires

## 💡 Utilisation

### Dans votre HTML/JSX
```tsx
// Appliquer un thème
<body className="theme-house">
  {/* Contenu */}
</body>

// Utiliser les couleurs Tailwind
<button className="bg-primary-600 hover:bg-primary-700">
  Bouton
</button>

// Utiliser les tokens shadcn
<div className="bg-card text-card-foreground border-border">
  Card
</div>

// Classes de composants
<button className="btn-primary">
  Bouton Primary
</button>

<input className="input-primary" />
```

### Dans votre CSS
```css
/* Utiliser les tokens de thème */
.custom-element {
  background: var(--color-primary-500);
  color: var(--color-primary-50);
}

/* Utiliser les tokens shadcn */
.semantic-element {
  background: hsl(var(--card));
  border-color: hsl(var(--border));
}
```

## 🎯 Bonnes Pratiques

### ✅ À FAIRE
- Utiliser `bg-primary-600` pour les couleurs de thème
- Utiliser `bg-card` pour les surfaces sémantiques
- Utiliser `text-foreground` pour le texte principal
- Utiliser `.btn-primary` pour les boutons standards
- Changer de thème via la classe `.theme-*` sur `<body>`

### ❌ À ÉVITER
- Hard-coder des couleurs : `#0ea5e9`
- Utiliser rgba() au lieu des tokens
- Mélanger les systèmes (rester cohérent dans un composant)

## 🌓 Mode Sombre

Le mode sombre est configuré via `.dark` sur `<html>` ou `<body>` :
```tsx
<html className="dark">
```

Les tokens shadcn s'adaptent automatiquement. Les thèmes personnalisés peuvent être étendus pour le dark mode si nécessaire.

## 🔧 Personnalisation

### Ajouter un nouveau thème
1. Éditer `themes.css` :
```css
.theme-custom {
    --color-primary-50: #...;
    /* ... autres couleurs ... */
    --ring: 120 50% 50%; /* HSL */
}
```

2. Utiliser : `<body className="theme-custom">`

### Modifier les tokens shadcn
Éditer les valeurs dans `globals.css` > `@layer base :root`

### Ajouter des utilities
Ajouter dans `globals.css` > `@layer utilities`

## 📦 Intégration Tailwind

Les tokens sont exposés dans `tailwind.config.ts` :
```typescript
colors: {
  primary: {
    '50': 'var(--color-primary-50)',
    // ...
    DEFAULT: 'hsl(var(--primary))'
  }
}
```

Cela permet d'utiliser à la fois :
- `bg-primary-600` (couleur spécifique du thème)
- `bg-primary` (token shadcn sémantique)
