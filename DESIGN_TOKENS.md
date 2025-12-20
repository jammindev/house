# 🎨 Design Tokens - Guide Complet

## Vue d'ensemble

Le système de design tokens de House combine **Tailwind CSS**, **shadcn/ui** et des **thèmes personnalisés** dans une architecture en couches cohérente.

```
┌─────────────────────────────────────┐
│   Composants React / HTML          │  ← Utilisation
├─────────────────────────────────────┤
│   Classes Tailwind (bg-primary-600)│  ← Tailwind Config
├─────────────────────────────────────┤
│   Tokens CSS Variables             │  ← globals.css
│   (--primary, --card, etc.)        │
├─────────────────────────────────────┤
│   Thèmes Couleurs                  │  ← themes.css
│   (.theme-blue, .theme-house, etc.)│
└─────────────────────────────────────┘
```

## 📂 Fichiers

### 1. `nextjs/src/styles/themes.css`
**Rôle :** Définit les palettes de couleurs pour chaque thème

**Contenu :**
- 7 thèmes : `blue`, `sass`, `sass2`, `sass3`, `house`, `purple`, `green`
- Chaque thème définit :
  - `--color-primary-{50-900}` : Couleur principale
  - `--color-secondary-{50-900}` : Gris/neutres
  - `--color-accent-{50-900}` : Couleur d'accent
  - `--ring` : Focus ring en HSL

**Exemple :**
```css
.theme-house {
    --color-primary-500: #329f6d; /* Vert evergreen */
    --ring: 153 52% 41%;
}
```

### 2. `nextjs/src/app/globals.css`
**Rôle :** Tokens shadcn/ui + utilities + composants

**Structure :**
1. **Imports Tailwind** (`@tailwind`)
2. **Import themes** (`@import themes.css`)
3. **Tokens shadcn/ui** (`@layer base`)
   - Variables sémantiques : `--background`, `--foreground`, `--primary`, etc.
   - Mode light & dark
4. **Composants** (`@layer components`)
   - `.btn-primary`, `.btn-secondary`
   - `.input-primary`
5. **Utilities** (`@layer utilities`)
   - `.scrollbar-hide`
   - `.glass-panel`, `.bg-glass`

### 3. `nextjs/tailwind.config.ts`
**Rôle :** Expose les tokens aux classes Tailwind

**Exemple :**
```typescript
colors: {
  primary: {
    '500': 'var(--color-primary-500)', // Depuis themes.css
    DEFAULT: 'hsl(var(--primary))'      // Depuis globals.css
  }
}
```

## 🎯 Deux systèmes de couleurs

### Système 1 : Couleurs de Thème (Tailwind)
```tsx
<button className="bg-primary-600 hover:bg-primary-700">
  Bouton
</button>
```
- Utilise directement les couleurs du thème (50-900)
- Disponible via Tailwind : `bg-primary-{x}`, `text-secondary-{x}`, etc.
- **Usage :** Composants visuels colorés

### Système 2 : Tokens Sémantiques (shadcn)
```tsx
<Card className="bg-card text-card-foreground border-border">
  Contenu
</Card>
```
- Utilise les variables sémantiques shadcn
- Disponible via Tailwind : `bg-card`, `text-foreground`, `border-border`, etc.
- **Usage :** Surfaces UI, textes, bordures
- **Avantage :** S'adapte automatiquement au mode dark

## 🔄 Workflow Complet

### 1. Choisir un thème
```tsx
// Dans votre layout ou page
export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="theme-house">
        {children}
      </body>
    </html>
  )
}
```

### 2. Utiliser les couleurs
```tsx
// Composant avec couleurs de thème
<div className="bg-primary-50 border-primary-200">
  <h1 className="text-primary-900">Titre</h1>
  <button className="bg-primary-600 text-white hover:bg-primary-700">
    Action
  </button>
</div>

// Composant avec tokens sémantiques
<Card className="bg-card text-card-foreground">
  <CardHeader className="border-border">
    <CardTitle className="text-foreground">Titre</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground">Description</p>
  </CardContent>
</Card>
```

### 3. Classes utilitaires prédéfinies
```tsx
// Boutons
<button className="btn-primary">Primary</button>
<button className="btn-secondary">Secondary</button>

// Inputs
<input className="input-primary" />

// Glass morphism
<div className="glass-panel">
  <p>Effet verre dépoli</p>
</div>
```

## 🌓 Mode Sombre

### Activation
```tsx
<html className="dark">
  {/* ... */}
</html>
```

### Comportement
- Les **tokens shadcn** changent automatiquement (`:root` → `.dark`)
- Les **couleurs de thème** restent identiques (peuvent être étendues si besoin)

### Variables adaptatives
```css
/* Light mode */
:root {
  --background: 0 0% 100%; /* Blanc */
  --foreground: 222 47% 11%; /* Presque noir */
}

/* Dark mode */
.dark {
  --background: 222 47% 11%; /* Presque noir */
  --foreground: 210 40% 98%; /* Presque blanc */
}
```

## 🔧 Personnalisation

### Créer un nouveau thème
1. Éditer `themes.css` :
```css
.theme-custom {
    /* Primary */
    --color-primary-50: #fef2f2;
    --color-primary-100: #fee2e2;
    --color-primary-200: #fecaca;
    --color-primary-300: #fca5a5;
    --color-primary-400: #f87171;
    --color-primary-500: #ef4444; /* Base */
    --color-primary-600: #dc2626;
    --color-primary-700: #b91c1c;
    --color-primary-800: #991b1b;
    --color-primary-900: #7f1d1d;

    /* Focus ring (HSL du primary-500) */
    --ring: 0 72% 51%;

    /* Secondary (neutres) */
    --color-secondary-50: #fafafa;
    /* ... */

    /* Accent */
    --color-accent-50: #fff7ed;
    /* ... */
}
```

2. Utiliser :
```tsx
<body className="theme-custom">
```

### Modifier les tokens shadcn
Éditer `globals.css` > `@layer base :root` :
```css
:root {
  --primary: 199 89% 48%; /* Changer la teinte HSL */
  --radius: 0.75rem; /* Border radius global */
}
```

### Ajouter une utility
Dans `globals.css` > `@layer utilities` :
```css
@layer utilities {
  .text-gradient {
    @apply bg-gradient-to-r from-primary-600 to-accent-600 
           bg-clip-text text-transparent;
  }
}
```

## 📋 Référence Rapide

### Tokens de Couleur (Thèmes)
| Token | Usage | Exemple Tailwind |
|-------|-------|------------------|
| `--color-primary-{50-900}` | Couleur principale | `bg-primary-600` |
| `--color-secondary-{50-900}` | Gris/neutres | `text-secondary-700` |
| `--color-accent-{50-900}` | Couleur d'accent | `border-accent-200` |

### Tokens Sémantiques (shadcn)
| Token | Usage | Exemple Tailwind |
|-------|-------|------------------|
| `--background` | Fond de page | `bg-background` |
| `--foreground` | Texte principal | `text-foreground` |
| `--card` | Fond de carte | `bg-card` |
| `--primary` | Action principale | `bg-primary` |
| `--secondary` | Action secondaire | `bg-secondary` |
| `--muted` | Éléments atténués | `bg-muted` |
| `--accent` | Mise en évidence | `bg-accent` |
| `--destructive` | Actions destructives | `bg-destructive` |
| `--border` | Bordures | `border-border` |
| `--input` | Champs de saisie | `bg-input` |
| `--ring` | Focus ring | `ring-ring` |

### Classes Composants
| Classe | Description |
|--------|-------------|
| `.btn-primary` | Bouton primaire avec couleurs du thème |
| `.btn-secondary` | Bouton secondaire |
| `.input-primary` | Input avec focus ring |
| `.glass-panel` | Effet verre dépoli (frosted glass) |
| `.bg-glass` | Background verre sans bordure |
| `.scrollbar-hide` | Cache les scrollbars |

## ✅ Bonnes Pratiques

### ✓ À FAIRE
- **Utiliser les tokens** au lieu de hard-coder des couleurs
- **Choisir le bon système** :
  - Tokens de thème (`primary-600`) pour les éléments colorés
  - Tokens shadcn (`card`, `foreground`) pour les surfaces/textes
- **Tester en dark mode** pour vérifier le contraste
- **Respecter la hiérarchie** : 50 (plus clair) → 900 (plus foncé)

### ✗ À ÉVITER
- ❌ Hard-coder : `className="bg-[#0ea5e9]"`
- ❌ Mélanger les systèmes incohéremment dans un même composant
- ❌ Utiliser `primary-500` comme base sans raison (préférer `primary-600`)
- ❌ Oublier le contraste en dark mode

## 🚀 Migration depuis l'ancien système

Si vous avez du code avec les anciens tokens :
```tsx
// Avant
<div className="bg-[#0ea5e9]">

// Après (thème)
<div className="bg-primary-500">

// Ou (sémantique)
<div className="bg-primary">
```

## 🔍 Debugging

### Inspecter les tokens
Dans DevTools :
```javascript
// Voir tous les tokens
getComputedStyle(document.documentElement).getPropertyValue('--primary')
getComputedStyle(document.documentElement).getPropertyValue('--color-primary-600')
```

### Thème actif
```javascript
// Vérifier le thème appliqué
document.body.classList.contains('theme-house') // true/false
```

### Mode sombre
```javascript
// Vérifier le dark mode
document.documentElement.classList.contains('dark') // true/false
```

---

**Dernière mise à jour :** 2025-01-20
