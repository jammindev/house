# Système de gestion des Z-Index

## Vue d'ensemble

Ce système centralisé de gestion des z-index garantit une superposition cohérente des éléments UI dans toute l'application House. Il remplace les z-index hardcodés par un système organisé en couches logiques avec TypeScript.

## Fonctionnalités

- ✅ **Centralisé** : Tous les z-index dans un seul endroit
- ✅ **Type-safe** : Support TypeScript complet
- ✅ **Flexible** : Classes Tailwind + valeurs numériques + hook React
- ✅ **Debuggable** : Outil de debug visuel en développement
- ✅ **Évolutif** : Espacement approprié pour futures additions
- ✅ **Migration** : Script automatique pour identifier les hardcoded z-index

## Installation et utilisation

### 1. Import et utilisation basique

```tsx
import { Z_INDEX_CLASSES } from '@/lib/design-tokens';

// Dans un composant
<div className={`fixed inset-0 ${Z_INDEX_CLASSES.overlay.backdrop}`}>
  <div className={`relative ${Z_INDEX_CLASSES.overlay.modal}`}>
    {/* Contenu de la modale */}
  </div>
</div>
```

### 2. Avec le hook React (recommandé)

```tsx
import { useZIndex } from '@/hooks/useZIndex';

function MyModal() {
  const { zClass, zIndex } = useZIndex();
  
  return (
    <div className={`fixed inset-0 ${zClass.overlay.backdrop}`}>
      <div 
        className={`fixed inset-4 ${zClass.overlay.modal}`}
        style={{ zIndex: zIndex.overlay.modal }}
      >
        {/* Contenu */}
      </div>
    </div>
  );
}
```

### 3. Classes Tailwind configurées

Les classes suivantes sont automatiquement disponibles :

```tsx
<div className="fixed top-0 z-nav-header">Header</div>
<div className="fixed inset-0 z-overlay-modal">Modal</div>
<div className="fixed top-4 right-4 z-system-toast">Toast</div>
```

## Structure des couches

| Catégorie | Plage | Usage |
|-----------|--------|-------|
| **Base** | 0 | Contenu normal |
| **Content** | 1-10 | Éléments surélevés, sticky |
| **Interactive** | 10-40 | Dropdowns, tooltips, popovers |
| **Navigation** | 50-80 | Headers, sidebars, menus |
| **Overlay** | 90-200 | Modales, dialogs, sheets |
| **System** | 500+ | Toasts, loading, debug |
| **Emergency** | 9999 | Messages critiques |

## Outils de développement

### Debug visuel
```bash
# Le debugger est automatiquement disponible en développement
# Cliquez sur le bouton "Show Z-Index" en bas à gauche
```

### Scanner les z-index existants
```bash
yarn z-index:scan
```

Ce script identifie tous les z-index hardcodés et propose des migrations.

## Migration du code existant

1. **Scannez votre code** :
   ```bash
   yarn z-index:scan
   ```

2. **Remplacez les valeurs hardcodées** :
   ```tsx
   // ❌ Avant
   <div className="fixed z-50">Modal</div>
   
   // ✅ Après
   <div className={`fixed ${Z_INDEX_CLASSES.overlay.modal}`}>Modal</div>
   ```

3. **Ajoutez l'import nécessaire** :
   ```tsx
   import { Z_INDEX_CLASSES } from '@/lib/design-tokens';
   ```

## Exemples complets

### Modal standard
```tsx
import { useZIndex } from '@/hooks/useZIndex';

export function MyModal({ children, isOpen }) {
  const { zClass } = useZIndex();
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div className={`fixed inset-0 bg-black/50 ${zClass.overlay.backdrop}`} />
      
      {/* Modal */}
      <div className={`fixed inset-4 bg-white rounded-lg ${zClass.overlay.modal}`}>
        {children}
      </div>
    </>
  );
}
```

### Navigation sticky
```tsx
import { Z_INDEX_CLASSES } from '@/lib/design-tokens';

export function StickyHeader() {
  return (
    <header className={`sticky top-0 bg-white ${Z_INDEX_CLASSES.content.sticky}`}>
      <nav>{/* Contenu navigation */}</nav>
    </header>
  );
}
```

### Tooltip
```tsx
import { useZIndex } from '@/hooks/useZIndex';

export function Tooltip({ children, content }) {
  const { zClass } = useZIndex();
  
  return (
    <div className="relative group">
      {children}
      <div className={`
        absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white rounded
        opacity-0 group-hover:opacity-100 transition-opacity
        ${zClass.interactive.tooltip}
      `}>
        {content}
      </div>
    </div>
  );
}
```

## Ajouter de nouveaux z-index

1. **Identifiez la catégorie** appropriée
2. **Choisissez une valeur** dans la plage disponible
3. **Ajoutez dans** `src/lib/design-tokens/z-index.ts`
4. **Mettez à jour** `tailwind.config.ts` si nécessaire
5. **Documentez** l'usage

Exemple :
```typescript
// Dans z-index.ts
export const Z_INDEX = {
  // ...
  interactive: {
    dropdown: 10,
    tooltip: 15,
    popover: 20,
    contextMenu: 25, // ← Nouveau
  },
  // ...
};
```

## Dépannage

### Problèmes courants

1. **Z-index ne fonctionne pas** :
   - Vérifiez que l'élément parent n'a pas `transform`, `filter`, ou `perspective`
   - Assurez-vous que `position` est défini (`relative`, `absolute`, `fixed`)

2. **Import non trouvé** :
   ```tsx
   // ✅ Import correct
   import { Z_INDEX_CLASSES } from '@/lib/design-tokens';
   ```

3. **Conflits de superposition** :
   - Utilisez le debugger visuel pour identifier les problèmes
   - Vérifiez que vous utilisez la bonne catégorie de z-index

### Debug avancé

```tsx
import { useZIndex } from '@/hooks/useZIndex';

// Voir toutes les valeurs disponibles
const { zIndex, zClass } = useZIndex();
console.log('Z-Index values:', zIndex);
console.log('Z-Index classes:', zClass);
```

## Configuration Tailwind

Les z-index sont automatiquement ajoutés à votre configuration Tailwind :

```typescript
// tailwind.config.ts (géré automatiquement)
module.exports = {
  theme: {
    extend: {
      zIndex: {
        'nav-header': '50',
        'overlay-modal': '100',
        // ...
      }
    }
  }
}
```

## Ressources

- **Guide détaillé** : `src/lib/design-tokens/Z_INDEX_GUIDE.md`
- **Types TypeScript** : `src/lib/design-tokens/z-index.ts`
- **Hook React** : `src/hooks/useZIndex.ts`
- **Debugger** : `src/components/dev/ZIndexDebugger.tsx`
- **Script migration** : `scripts/migrate-z-index.js`

## Support

En cas de problème ou pour ajouter de nouveaux z-index, consultez l'équipe de développement ou créez une issue avec le tag `design-system`.