# Tests pour le Système de Filtrage des Interactions

Ce document décrit la suite de tests complète pour le système de filtrage des interactions dans les projets.

## 🎯 Objectifs des Tests

Le système de filtrage permet de :
- **Cacher les tâches incomplètes** par défaut (statut `pending` ou `in_progress`)
- **Ajouter/enlever facilement** des filtres via un mécanisme générique
- **Personnaliser l'affichage** des interactions dans la timeline des projets

## 📋 Types de Tests

### 1. Tests Unitaires (Vitest)

**`interactionFilters.test.ts`** - Logique de filtrage
- ✅ Filtre `hideIncompleteTasks` : cache les tâches non terminées
- ✅ Filtre `hideArchived` : cache les interactions archivées  
- ✅ Filtres par type : `showOnlyNotes`, `showOnlyExpenses`
- ✅ Filtre `showCompletedOnly` : affiche seulement les éléments terminés
- ✅ Fonction `applyFilters` : combine multiple filtres avec logique AND
- ✅ Gestion des filtres par défaut et filtres inconnus

**`ProjectTimeline.test.tsx`** - Composant timeline
- ✅ Rendu de l'état vide quand pas d'interactions
- ✅ Rendu des interactions avec filtrage par défaut
- ✅ Application de filtres personnalisés
- ✅ Gestion des documents counts
- ✅ État vide quand toutes les interactions sont filtrées

**`InteractionFilterToggle.test.tsx`** - Interface de filtrage
- ✅ Affichage du bouton avec compteur de filtres actifs
- ✅ Ouverture/fermeture du dropdown
- ✅ Affichage de tous les filtres disponibles avec descriptions
- ✅ État coché pour les filtres actifs
- ✅ Toggle des filtres (ajout/suppression)
- ✅ Boutons "Default" et "Clear all"
- ✅ Fermeture au clic extérieur

### 2. Tests End-to-End (Playwright)

**`project-interaction-filters.spec.ts`** - Interface utilisateur complète
- ✅ Les tâches incomplètes sont cachées par défaut
- ✅ Affichage du toggle de filtres avec compteur correct
- ✅ Activation/désactivation des filtres via UI
- ✅ Sélection de multiple filtres
- ✅ Fonctionnalité "Clear all" et "Default"
- ✅ Persistance de l'état des filtres lors de la navigation
- ✅ État vide quand toutes les interactions sont filtrées

## 🚀 Lancement des Tests

### Tous les tests du système de filtrage
```bash
./test-interaction-filters.sh
```

### Tests par catégorie
```bash
# Tests unitaires seulement
cd nextjs && yarn test:unit

# Tests E2E seulement  
cd nextjs && yarn test:e2e

# Test spécifique
cd nextjs && yarn vitest run src/features/projects/lib/__tests__/interactionFilters.test.ts
```

### Tests en mode watch (développement)
```bash
cd nextjs && yarn vitest --watch
```

## 📊 Couverture de Tests

| Composant | Type | Fichier | Couverture |
|-----------|------|---------|------------|
| Logique filtrage | Unit | `interactionFilters.test.ts` | 100% |
| ProjectTimeline | Unit | `ProjectTimeline.test.tsx` | Rendu + filtrage |
| FilterToggle | Unit | `InteractionFilterToggle.test.tsx` | UI complète |
| Interface complète | E2E | `project-interaction-filters.spec.ts` | Workflow complet |

## 🔧 Configuration

### Vitest (Tests Unitaires)
- **Environment**: jsdom pour tests React
- **Setup**: `vitest.setup.ts` avec polyfills
- **Alias**: Paths configurés (`@interactions`, `@projects`, etc.)
- **Mocks**: i18n et composants externes

### Playwright (Tests E2E)
- **Browsers**: Chromium, Firefox, Safari
- **Base URL**: http://localhost:3000
- **Setup**: Création d'utilisateurs/ménages/projets de test
- **Cleanup**: Suppression automatique des données de test

## 🎯 Cas d'Usage Testés

### Filtrage par Défaut
```typescript
// Cache automatiquement les tâches pending/in_progress
const interactions = [
  { type: 'todo', status: 'pending' },    // ❌ Caché
  { type: 'todo', status: 'done' },       // ✅ Affiché
  { type: 'note', status: null }          // ✅ Affiché
];
```

### Filtres Multiples
```typescript
// Combine: cache tâches incomplètes + cache archivés
applyFilters(interactions, ['hideIncompleteTasks', 'hideArchived'])
```

### Filtres par Type
```typescript
// Affiche seulement les notes
applyFilters(interactions, ['showOnlyNotes'])
```

## 🐛 Débogage

### Tests unitaires qui échouent
```bash
cd nextjs && yarn vitest --reporter=verbose --run src/path/to/test.ts
```

### Tests E2E qui échouent
```bash
cd nextjs && yarn test:e2e --headed --debug project-interaction-filters.spec.ts
```

### Vérifier les mocks
```bash
# Vérifier que les mocks i18n fonctionnent
cd nextjs && yarn vitest --reporter=verbose src/features/projects/components/__tests__/
```

## 📝 Ajouter de Nouveaux Filtres

1. **Ajouter le filtre** dans `interactionFilters.ts`
```typescript
newFilter: {
  name: "New Filter Name",
  description: "What this filter does", 
  filter: (interaction: Interaction) => boolean
}
```

2. **Ajouter les tests unitaires** dans `interactionFilters.test.ts`
```typescript
it('should apply new filter correctly', () => {
  const filter = INTERACTION_FILTERS.newFilter;
  // Test cases...
});
```

3. **Ajouter les tests E2E** dans `project-interaction-filters.spec.ts`
```typescript
test("should handle new filter in UI", async ({ page }) => {
  // UI interaction tests...
});
```

4. **Ajouter les traductions** dans les dictionnaires i18n si nécessaire

## ✅ Validation Continue

Ces tests s'intègrent dans le pipeline CI/CD pour valider automatiquement :
- 🔒 **Régression** : Les filtres existants continuent de fonctionner
- 🚀 **Nouvelles fonctionnalités** : Les nouveaux filtres sont testés
- 🎨 **Interface utilisateur** : L'UI répond correctement aux interactions
- 📊 **Performance** : Les filtres n'impactent pas les performances de rendu