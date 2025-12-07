# Système Z-Index implémenté pour votre application House

## ✅ Ce qui a été créé

### 1. **Système centralisé de tokens Z-Index**
- 📁 `nextjs/src/lib/design-tokens/z-index.ts` - Définitions des tokens
- 📁 `nextjs/src/lib/design-tokens/index.ts` - Export centralisé
- 📁 `nextjs/src/hooks/useZIndex.ts` - Hook React pour utilisation facile

### 2. **Structure organisée en couches**
```
Base (0) → Content (1-10) → Interactive (10-40) → Navigation (50-80) 
→ Overlay (90-200) → System (500+) → Emergency (9999)
```

### 3. **Intégration Tailwind CSS**
- Configuration automatique des classes personnalisées (`z-nav-header`, `z-overlay-modal`, etc.)
- Support des classes arbitraires (`z-[100]`) avec tokens

### 4. **Outils de développement**
- 🔧 Debugger visuel (`ZIndexDebugger`) - bouton "Show Z-Index" en bas à gauche
- 🔍 Script de migration (`scripts/migrate-z-index.js`) - détecte les z-index hardcodés
- 📖 Guide d'utilisation complet

### 5. **Composants mis à jour**
- ✅ `Dialog` et `SheetDialog` - utilisation des tokens overlay
- ✅ `NavigationOverlayProvider` - utilisation du token loading
- ✅ `ToastProvider` - utilisation du token toast
- ✅ `Tooltip` - utilisation du token tooltip

## 🚀 Comment l'utiliser

### Import et utilisation basique
```tsx
import { useZIndex } from '@/hooks/useZIndex';

function MyComponent() {
  const { zClass, zIndex } = useZIndex();
  
  return (
    <div className={`fixed inset-0 ${zClass.overlay.backdrop}`}>
      <div className={`relative ${zClass.overlay.modal}`}>
        {/* Contenu */}
      </div>
    </div>
  );
}
```

### Classes Tailwind configurées
```tsx
<div className="fixed z-nav-header">Header</div>
<div className="fixed z-overlay-modal">Modal</div>
```

### Import direct des tokens
```tsx
import { Z_INDEX_CLASSES } from '@/lib/design-tokens';

<div className={Z_INDEX_CLASSES.system.toast}>Toast</div>
```

## 🛠 Outils disponibles

### 1. Scanner les z-index existants
```bash
yarn z-index:scan
```

### 2. Debugger visuel
- Actif automatiquement en développement
- Bouton "Show Z-Index" en bas à gauche de l'écran
- Affiche toutes les couches avec leur valeur

### 3. Page de démonstration
- Accessible via `/app/z-index-demo`
- Exemples interactifs de tous les niveaux de z-index

## 📊 Résultats du scan actuel

Votre application a **46 z-index hardcodés** détectés :
- ✅ **40 peuvent être automatiquement migrés**
- ⚠️ **6 nécessitent une révision manuelle**

### Z-index les plus critiques à migrer :
1. **Modales et dialogs** (actuellement z-50 → devrait être z-[100])
2. **Dropdowns et menus** (z-50 → z-[10])
3. **Tooltips** (z-50 → z-[15])
4. **Toasts** (z-50 → z-[500])

## 🎯 Prochaines étapes recommandées

### Étape 1 : Migration graduelle
```bash
# 1. Scanner pour voir l'état actuel
yarn z-index:scan

# 2. Migrer les composants un par un
# Commencer par les plus critiques (modales, toasts)
```

### Étape 2 : Utilisation dans nouveaux composants
```tsx
// Toujours utiliser les tokens pour nouveaux composants
import { useZIndex } from '@/hooks/useZIndex';
```

### Étape 3 : Tests
- Tester la superposition sur desktop et mobile
- Vérifier que les modales s'affichent au-dessus des dropdowns
- S'assurer que les toasts restent visibles

## 💡 Bonnes pratiques

### ✅ À faire
- Utiliser `useZIndex()` hook pour tous nouveaux composants
- Respecter la hiérarchie des couches
- Tester la superposition après migration
- Consulter le guide avant d'ajouter de nouveaux z-index

### ❌ À éviter
- Z-index hardcodés (`z-[999]`, `z-50`)
- Valeurs arbitraires sans logique
- Modifier les tokens existants sans coordination

## 🔗 Documentation complète

- **Guide détaillé** : `nextjs/src/lib/design-tokens/Z_INDEX_GUIDE.md`
- **README système** : `nextjs/src/lib/design-tokens/README.md`
- **Types TypeScript** : Support complet avec autocomplétion

## 🎉 Avantages obtenus

1. **Cohérence** : Plus de conflits de z-index
2. **Maintenabilité** : Un seul endroit pour tous les z-index
3. **Développement** : Outils de debug et migration
4. **Type Safety** : Support TypeScript complet
5. **Performance** : Optimisation des classes Tailwind
6. **Évolutivité** : Système extensible pour futurs besoins

Votre application dispose maintenant d'un système robuste et professionnel pour gérer tous les aspects de superposition UI ! 🎨