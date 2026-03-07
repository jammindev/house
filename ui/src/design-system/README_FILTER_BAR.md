# FilterBar Component

Un composant réutilisable et accessible pour créer des barres de filtrage dans l'application.

## Caractéristiques

- **Composant pur** : Aucune logique métier, uniquement UI et accessibilité
- **Flexible** : Supporte les champs de recherche et les selects
- **Responsive** : S'adapte aux différentes tailles d'écran
- **Accessible** : Labels HTML corrects, support clavier (Enter sur recherche)
- **Personnalisable** : Actions custom, labels configurables, styling via className

## Types de champs

### Search Field
Champ de recherche avec bouton "Appliquer". Support de la touche Enter.

### Select Field
Menu déroulant avec options configurables.

## Utilisation de base

```tsx
import { FilterBar } from '@/design-system/filter-bar';
import { Button } from '@/design-system/button';

function MyList() {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');

  const handleReset = () => {
    setSearch('');
    setStatus('');
  };

  return (
    <FilterBar
      fields={[
        {
          type: 'search',
          id: 'search',
          label: 'Recherche',
          value: search,
          onChange: setSearch,
          placeholder: 'Rechercher...',
        },
        {
          type: 'select',
          id: 'status',
          label: 'Statut',
          value: status,
          onChange: setStatus,
          options: [
            { value: '', label: 'Tous les statuts' },
            { value: 'active', label: 'Actif' },
            { value: 'completed', label: 'Terminé' },
          ],
        },
      ]}
      onReset={handleReset}
      hasActiveFilters={!!search || !!status}
    />
  );
}
```

## Avec actions personnalisées

```tsx
<FilterBar
  fields={[...]}
  onReset={handleReset}
  hasActiveFilters={hasFilters}
  actions={
    <Button asChild>
      <a href="/projects/new">Nouveau projet</a>
    </Button>
  }
/>
```

## Exemple complet : Liste de projets

```tsx
import * as React from 'react';
import { FilterBar } from '@/design-system/filter-bar';
import { Button } from '@/design-system/button';

export default function ProjectList() {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [type, setType] = React.useState('');
  const [groupId, setGroupId] = React.useState('');
  const [groups, setGroups] = React.useState([
    { id: '1', name: 'Groupe A' },
    { id: '2', name: 'Groupe B' },
  ]);

  const handleReset = () => {
    setSearch('');
    setStatus('');
    setType('');
    setGroupId('');
  };

  const hasActiveFilters = !!(search || status || type || groupId);

  return (
    <div className="space-y-4">
      <FilterBar
        fields={[
          {
            type: 'search',
            id: 'proj-search',
            label: 'Recherche',
            value: search,
            onChange: setSearch,
            placeholder: 'Rechercher des projets...',
          },
          {
            type: 'select',
            id: 'proj-status',
            label: 'Statut',
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'Tous les statuts' },
              { value: 'draft', label: 'Brouillon' },
              { value: 'active', label: 'Actif' },
              { value: 'completed', label: 'Terminé' },
            ],
          },
          {
            type: 'select',
            id: 'proj-type',
            label: 'Type',
            value: type,
            onChange: setType,
            options: [
              { value: '', label: 'Tous les types' },
              { value: 'renovation', label: 'Rénovation' },
              { value: 'maintenance', label: 'Maintenance' },
            ],
          },
          {
            type: 'select',
            id: 'proj-group',
            label: 'Groupe',
            value: groupId,
            onChange: setGroupId,
            options: [
              { value: '', label: 'Tous les groupes' },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ],
          },
        ]}
        onReset={handleReset}
        hasActiveFilters={hasActiveFilters}
        resetLabel="Réinitialiser"
        applyLabel="Appliquer"
        actions={
          <Button asChild>
            <a href="/app/projects/new/">Nouveau projet</a>
          </Button>
        }
      />

      {/* Votre liste ici */}
    </div>
  );
}
```

## Props

### FilterBarProps

| Prop | Type | Description |
|------|------|-------------|
| `fields` | `FilterField[]` | Tableau des champs de filtre à afficher |
| `onReset` | `() => void` | Callback appelé lors du clic sur réinitialiser |
| `hasActiveFilters` | `boolean` | Indique si des filtres sont actifs (désactive le bouton reset si false) |
| `actions` | `React.ReactNode` | Actions personnalisées à afficher (ex: bouton "Nouveau") |
| `className` | `string` | Classe CSS optionnelle pour le conteneur |
| `resetLabel` | `string` | Texte du bouton reset (défaut: "Reset") |
| `applyLabel` | `string` | Texte du bouton apply pour les champs de recherche (défaut: "Apply") |

### FilterField

| Prop | Type | Description |
|------|------|-------------|
| `type` | `'search' \| 'select'` | Type de champ |
| `id` | `string` | ID HTML unique du champ |
| `label` | `string` | Label affiché au-dessus du champ |
| `value` | `string` | Valeur actuelle du champ |
| `onChange` | `(value: string) => void` | Callback appelé lors du changement de valeur |
| `placeholder` | `string` | Placeholder pour les champs de recherche |
| `options` | `Array<{value: string, label: string}>` | Options pour les selects |
| `className` | `string` | Classe CSS optionnelle pour le champ |

## Layout responsive

Le composant s'adapte automatiquement :
- Mobile : 2 colonnes pour les selects
- Desktop (md+) : 4 colonnes pour les selects
- Les champs de recherche prennent toute la largeur

## Accessibilité

- Labels HTML associés via `htmlFor` et `id`
- Support de la navigation au clavier
- Touche Enter valide la recherche
- Bouton reset désactivé quand pas de filtres actifs
- Structure sémantique HTML

## Notes d'implémentation

### Gestion de l'état

Le composant est **contrôlé** : vous devez gérer l'état des filtres dans le composant parent.

### Synchronisation URL

Le composant ne gère **pas** la synchronisation avec l'URL. C'est à vous de l'implémenter si nécessaire :

```tsx
React.useEffect(() => {
  const url = new URL(window.location.href);
  if (search) {
    url.searchParams.set('search', search);
  } else {
    url.searchParams.delete('search');
  }
  window.history.replaceState({}, '', url.toString());
}, [search]);
```

### Appel API

Le composant ne fait **pas** d'appels API. Gérez les chargements de données dans le composant parent :

```tsx
React.useEffect(() => {
  fetchData({ search, status, type });
}, [search, status, type]);
```
