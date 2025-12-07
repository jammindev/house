# Guide d'utilisation du système Z-Index

## Vue d'ensemble

Ce système de z-index centralisé garantit une superposition cohérente des éléments UI dans toute l'application. Il est organisé en couches logiques avec un espacement approprié pour permettre des insertions futures.

## Structure des couches

### 1. Contenu de base (`0-10`)
- `base` (0) : Contenu normal
- `content.raised` (1) : Éléments légèrement surélevés (cartes avec ombres)
- `content.sticky` (5) : Headers collants, éléments de navigation

### 2. Éléments interactifs (`10-40`)
- `interactive.dropdown` (10) : Menus déroulants, options de sélection
- `interactive.tooltip` (15) : Info-bulles, petites overlays
- `interactive.popover` (20) : Popovers, overlays contextuelles plus grandes

### 3. Navigation (`50-80`)
- `navigation.header` (50) : Header de navigation principal
- `navigation.sidebar` (55) : Navigation latérale
- `navigation.mobileMenu` (60) : Overlays de navigation mobile

### 4. Modales/Dialogs (`90-200`)
- `overlay.backdrop` (90) : Arrière-plans de modales
- `overlay.modal` (100) : Modales et dialogs standard
- `overlay.sheet` (110) : Bottom sheets, side sheets
- `overlay.drawer` (120) : Tiroirs coulissants

### 5. Système (`500+`)
- `system.toast` (500) : Notifications toast
- `system.loading` (900) : Overlays de chargement global
- `system.debug` (999) : Overlays de debug (dev seulement)

### 6. Urgence (`9999`)
- `emergency` (9999) : Messages système critiques, overlays d'urgence

## Utilisation

### 1. Avec le hook React

```tsx
import { useZIndex } from '@/hooks/useZIndex';

function MyComponent() {
  const { zClass, zIndex, getZ } = useZIndex();
  
  return (
    <div className={`fixed inset-0 ${zClass.overlay.backdrop}`}>
      <div className={`relative ${zClass.overlay.modal}`}>
        {/* Contenu de la modale */}
      </div>
    </div>
  );
}
```

### 2. Import direct des classes

```tsx
import { Z_INDEX_CLASSES } from '@/lib/design-tokens';

function MyDialog() {
  return (
    <div className={`fixed inset-0 ${Z_INDEX_CLASSES.overlay.backdrop}`}>
      {/* Contenu */}
    </div>
  );
}
```

### 3. Classes Tailwind configurées

```tsx
// Ces classes sont automatiquement disponibles grâce à la config Tailwind
function MyComponent() {
  return (
    <div className="fixed top-0 z-overlay-modal">
      {/* Contenu */}
    </div>
  );
}
```

### 4. Valeurs numériques pour du CSS-in-JS

```tsx
import { Z_INDEX } from '@/lib/design-tokens';

const styles = {
  modal: {
    position: 'fixed',
    zIndex: Z_INDEX.overlay.modal, // 100
  }
};
```

## Bonnes pratiques

### ✅ À faire
- Utiliser toujours les tokens définis plutôt que des valeurs arbitraires
- Respecter la hiérarchie logique des couches
- Documenter les nouveaux z-index dans ce système
- Tester la superposition sur mobile et desktop

### ❌ À éviter
- Utiliser des z-index arbitraires comme `z-[999]` ou `z-[1234]`
- Créer des conflits en utilisant la même valeur pour des contextes différents
- Modifier les valeurs existantes sans coordination avec l'équipe

## Exemples d'utilisation courante

### Modal standard
```tsx
<div className={Z_INDEX_CLASSES.overlay.backdrop}>
  <div className={Z_INDEX_CLASSES.overlay.modal}>
    {/* Contenu de la modale */}
  </div>
</div>
```

### Tooltip
```tsx
<div className={`absolute ${Z_INDEX_CLASSES.interactive.tooltip}`}>
  {/* Contenu du tooltip */}
</div>
```

### Navigation sticky
```tsx
<header className={`sticky top-0 ${Z_INDEX_CLASSES.content.sticky}`}>
  {/* Navigation */}
</header>
```

### Toast notification
```tsx
<div className={`fixed top-4 right-4 ${Z_INDEX_CLASSES.system.toast}`}>
  {/* Notification */}
</div>
```

## Ajouter de nouveaux z-index

1. Identifiez la catégorie appropriée
2. Choisissez une valeur dans la plage disponible
3. Ajoutez le token dans `src/lib/design-tokens/z-index.ts`
4. Mettez à jour la configuration Tailwind si nécessaire
5. Documentez l'usage dans ce guide

## Migration du code existant

Pour migrer du code existant :

1. Identifiez les z-index hardcodés (`z-[50]`, `z-50`, etc.)
2. Déterminez le contexte d'usage (modal, tooltip, navigation, etc.)
3. Remplacez par le token approprié
4. Testez le comportement de superposition

## Debugging

Pour debugger des problèmes de z-index :

1. Utilisez les outils de développement du navigateur
2. Activez temporairement `Z_INDEX_CLASSES.system.debug` pour voir les couches
3. Vérifiez que les éléments parents n'ont pas de `transform` ou `position` qui créent des contextes de superposition
4. Consultez l'équipe avant de créer des exceptions

## Support TypeScript

Le système fournit une sécurité de type complète :

```tsx
// ✅ Types corrects
const modalZ = Z_INDEX.overlay.modal; // number
const modalClass = Z_INDEX_CLASSES.overlay.modal; // string

// ❌ Erreur TypeScript
const invalidZ = Z_INDEX.invalid.property; // Error
```