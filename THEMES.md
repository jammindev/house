# Système de Thèmes House

Ce document explique comment fonctionne le système de thèmes de l'application House et comment l'utiliser.

## Vue d'ensemble

L'application House propose 17 thèmes différents organisés par catégorie (chaud, froid, neutre, vibrant). Chaque thème définit des variables CSS pour les couleurs primaires, secondaires et d'accentuation.

## Structure des fichiers

### Fichiers principaux

- **`nextjs/src/styles/themes.css`** : Définitions CSS de tous les thèmes
- **`nextjs/src/lib/themes/themes.config.ts`** : Configuration et métadonnées des thèmes
- **`nextjs/src/lib/themes/index.ts`** : Point d'entrée pour importer les utilitaires de thème

### Fichiers de traduction

- **`nextjs/src/lib/i18n/dictionaries/en.json`** : Traductions anglaises
- **`nextjs/src/lib/i18n/dictionaries/fr.json`** : Traductions françaises

## Thèmes disponibles

### Thèmes froids (Cool)
1. **Blue** - Tons bleus frais et professionnels
2. **Sass3 (Ocean)** - Bleus océan avec neutres sableux *(par défaut)*
3. **Teal** - Sarcelle rafraîchissante avec accents ambrés
4. **Indigo** - Indigo profond avec accents magenta
5. **Cyan** - Cyan vif avec accents oranges
6. **Green** - Vert frais avec accents dorés
7. **Emerald** - Émeraude riche avec touches ambrées
8. **Midnight** - Bleu minuit profond avec touches magenta

### Thèmes chauds (Warm)
1. **House** - Fondation verte avec accents chaleureux
2. **Crimson** - Rouge audacieux avec touches orangées
3. **Amber** - Tons ambrés et dorés chaleureux

### Thèmes vibrants (Vibrant)
1. **Sass (Pink)** - Rose vibrant avec des accents violets
2. **Purple** - Violet riche avec touches roses
3. **Rose** - Rose élégant avec touches émeraude
4. **Lavender** - Lavande douce avec accents oranges

### Thèmes neutres (Neutral)
1. **Sass2 (Sage)** - Sauge naturelle et chaleur terracotta
2. **Slate** - Gris ardoise moderne avec accents ambrés

## Variables CSS

Chaque thème définit 3 palettes de couleurs avec 10 nuances chacune (50-900) :

```css
.theme-[nom] {
    /* Couleurs primaires (principal) */
    --color-primary-50: ...;
    --color-primary-100: ...;
    /* ... jusqu'à */
    --color-primary-900: ...;

    /* Couleurs secondaires (texte, bordures) */
    --color-secondary-50: ...;
    /* ... */
    --color-secondary-900: ...;

    /* Couleurs d'accent (highlights, CTA) */
    --color-accent-50: ...;
    /* ... */
    --color-accent-900: ...;
}
```

## Utilisation dans le code

### Importer la configuration

```typescript
import { AVAILABLE_THEMES, getDefaultTheme, isValidTheme } from '@/lib/themes';
```

### Fonctions utilitaires

#### `AVAILABLE_THEMES`
Tableau de tous les thèmes disponibles avec leurs métadonnées :

```typescript
const themes = AVAILABLE_THEMES;
// [
//   { value: 'blue', label: 'theme.blue', description: 'theme.blueDescription', category: 'cool' },
//   ...
// ]
```

#### `getDefaultTheme()`
Obtient le thème par défaut depuis les variables d'environnement :

```typescript
const defaultTheme = getDefaultTheme(); // 'sass3'
```

#### `isValidTheme(theme: string)`
Valide qu'un thème existe :

```typescript
if (isValidTheme('blue')) {
  // Thème valide
}
```

#### `getThemeInfo(themeValue: string)`
Obtient les informations complètes d'un thème :

```typescript
const info = getThemeInfo('blue');
// { value: 'blue', label: 'theme.blue', description: '...', category: 'cool' }
```

#### `getThemesByCategory()`
Regroupe les thèmes par catégorie :

```typescript
const grouped = getThemesByCategory();
// {
//   cool: [...],
//   warm: [...],
//   neutral: [...],
//   vibrant: [...]
// }
```

### Exemple d'utilisation dans un composant

```tsx
import { AVAILABLE_THEMES } from '@/lib/themes';
import { useI18n } from '@/lib/i18n/I18nProvider';

function ThemeSelector() {
  const { t } = useI18n();
  const [theme, setTheme] = useState('sass3');

  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
      {AVAILABLE_THEMES.map((theme) => (
        <option key={theme.value} value={theme.value}>
          {t(theme.label)}
        </option>
      ))}
    </select>
  );
}
```

## Utilisation en CSS/Tailwind

Les variables de couleur sont accessibles via Tailwind :

```tsx
<div className="bg-primary-500 text-white">
  <p className="text-secondary-600">Contenu</p>
  <button className="bg-accent-600 hover:bg-accent-700">
    Action
  </button>
</div>
```

## Ajouter un nouveau thème

### 1. Ajouter les définitions CSS

Dans `nextjs/src/styles/themes.css` :

```css
.theme-nouveau {
    --color-primary-50: #...;
    /* ... définir toutes les nuances */
}
```

### 2. Ajouter à la configuration

Dans `nextjs/src/lib/themes/themes.config.ts` :

```typescript
export const AVAILABLE_THEMES: ThemeOption[] = [
  // ...thèmes existants
  {
    value: 'nouveau',
    label: 'theme.nouveau',
    description: 'theme.nouveauDescription',
    category: 'cool' // ou 'warm', 'neutral', 'vibrant'
  }
];
```

### 3. Ajouter les traductions

Dans `en.json` et `fr.json` :

```json
{
  "theme.nouveau": "Nouveau Thème",
  "theme.nouveauDescription": "Description du nouveau thème"
}
```

## Stockage du thème utilisateur

Le thème sélectionné par l'utilisateur est stocké dans :
- Les métadonnées Supabase Auth : `user.user_metadata.theme`
- Appliqué automatiquement au chargement de la page via `GlobalContext`

## Migration depuis l'ancien système

Les anciens thèmes codés en dur dans `globals.css` ont été déplacés vers le fichier dédié `themes.css`. Le comportement reste identique mais la maintenance est maintenant centralisée.

## Support et maintenance

Pour toute question ou amélioration du système de thèmes, consultez :
- La documentation AGENTS.md pour l'architecture globale
- Le composant UserSettings.tsx pour l'implémentation de référence
- Le GlobalContext pour la gestion du thème actif
