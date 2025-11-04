# Routes d'interactions spécialisées

Ce fichier documente les routes spécialisées pour la création d'interactions par type.

## Routes disponibles

### Formulaires spécialisés avec composants dédiés
- `/app/interactions/new/todo` → **TaskForm** (Tâches)
- `/app/interactions/new/quote` → **QuoteForm** (Devis avec montant et associations)
- `/app/interactions/new/note` → **NoteForm** (Notes simples)
- `/app/interactions/new/expense` → **NoteForm** (Dépenses, statut "done" par défaut)

### Formulaires basés sur NoteForm avec personnalisations
- `/app/interactions/new/call` → **NoteForm** (Appels, statut "done" par défaut)
- `/app/interactions/new/visit` → **NoteForm** (Visites, statut "done" par défaut)

### Route de sélection de type
- `/app/interactions/new` → **InteractionTypeSelector** (Sélecteur visuel des types)

### Route générique pour types non spécialisés
- `/app/interactions/new?type=<type>` → **InteractionForm** (Formulaire original)

## Paramètres supportés

Toutes les routes acceptent les paramètres URL suivants :
- `?projectId=<uuid>` : Pré-sélectionne un projet
- `?status=<status>` : Pré-sélectionne un statut

Exemple : `/app/interactions/new/todo?projectId=123&status=pending`

## Navigation depuis le dashboard

### DashboardQuickActions
- Types spécialisés : redirige vers `/app/interactions/new/<type>`
- Types génériques : redirige vers `/app/interactions/new?type=<type>`

### ProjectQuickActions
- Tâche : `/app/interactions/new/todo?projectId=<id>`
- Note : `/app/interactions/new/note?projectId=<id>`
- Dépense : `/app/interactions/new/expense?projectId=<id>`
- Appel : `/app/interactions/new/call?projectId=<id>`
- Document : `/app/interactions/new?projectId=<id>&type=document` (générique)

## Composants de détails et édition

### Factory patterns pour l'extensibilité
- **InteractionDetailFactory** : Sélectionne le bon composant de détail selon le type
- **InteractionEditFactory** : Sélectionne le bon formulaire d'édition selon le type

### Composants de détail
- `TaskDetail` : Affichage spécialisé pour les tâches
- `QuoteDetail` : Affichage du montant et infos devis
- `BaseInteractionDetail` : Affichage générique par défaut