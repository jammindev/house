# 2026-03-18 — Améliorations du module Tasks

## Contexte

Session d'amélioration itérative du module Tasks suite à un audit produit. Objectif : corriger les bugs existants, compléter les fonctionnalités manquantes et améliorer l'ergonomie générale.

---

## Bugs corrigés

### Toast de suppression invisible

**Cause 1 (principale) :** le composant `<Toaster />` n'était pas monté dans l'arbre React de la SPA. Le store Zustand fonctionnait correctement mais rien ne lisait les toasts pour les rendre.

**Fix :** ajout de `<Toaster />` dans `ui/src/main.tsx`, à côté de `<RouterProvider />`.

**Cause 2 :** dans `useDeleteWithUndo`, un `toastId` était généré localement *avant* l'appel à `toast()`, mais le store génère son propre ID au moment de l'insertion. Les deux IDs ne correspondaient jamais → `dismiss(toastId)` échouait silencieusement, le toast ne se fermait pas à l'annulation.

**Fix :** `toast()` retourne désormais l'ID qu'il a généré (`string`). L'ordre dans `useDeleteWithUndo` a été inversé : appel `toast()` en premier, récupération de l'ID retourné, puis `pendingRef.set()` avec ce vrai ID.

Fichiers modifiés :
- `ui/src/main.tsx`
- `ui/src/lib/toast.ts` — signature `toast()` → retourne `string`
- `ui/src/lib/useDeleteWithUndo.ts`

### Flash empty state au chargement

**Cause :** quand la page se charge avec des tâches existantes, `isLoading=true` → `isEmpty=false` → `ListPage` rendait `children` (skeleton) → puis `isLoading=false` avec des données → switch vers la liste. Quand les données étaient *vides*, le même chemin produisait : skeleton → empty state, visible comme un flash de layout.

**Fix :** le skeleton est rendu *avant* `ListPage`, avec un early return si `isLoading`. `ListPage` ne voit donc plus jamais le skeleton — elle reçoit directement soit les tâches, soit l'état vide une fois le chargement terminé.

Fichier modifié : `ui/src/features/tasks/TasksPage.tsx`

### Icône calendrier invisible en dark mode

**Cause :** l'icône native du `<input type="date">` utilise la `color-scheme` du document, qui reste claire même en dark mode applicatif.

**Fix :** ajout de `dark:[color-scheme:dark]` dans le className du composant `Input`.

Fichier modifié : `ui/src/design-system/input.tsx`

---

## Nouvelles fonctionnalités

### Soft delete — archivage au lieu de suppression

**Comportement :** `DELETE /tasks/{id}/` n'efface plus la ligne. Le ViewSet override `perform_destroy()` pour passer la tâche en `status='archived'` et mettre à jour `updated_by`.

**Restriction :** seul le créateur de la tâche peut la supprimer. Si un autre membre tente l'opération, une `PermissionDenied` (403) est levée.

**Frontend :** le bouton de suppression dans `TaskCard` n'est visible que si `task.created_by === user.id` (comparaison en chaîne pour absorber le type integer/string). Le flux `useDeleteWithUndo` reste inchangé — le DELETE envoyé au backend est simplement intercepté par le nouveau `perform_destroy()`.

**Filtre existant préservé :** `useTasks()` filtre déjà `status !== 'archived'`, les tâches archivées disparaissent donc naturellement de l'UI.

Fichiers modifiés :
- `apps/tasks/views.py`
- `ui/src/features/tasks/TaskCard.tsx`

### Champ `created_by_name` dans le serializer

Ajout d'un `SerializerMethodField` `created_by_name` exposant le `full_name` du créateur, cohérent avec `assigned_to_name` et `completed_by_name`.

Fichier modifié : `apps/tasks/serializers.py`

### Sélecteur de projet dans la modale de création/édition

Le champ `project` (FK nullable) existait côté modèle et serializer mais n'était pas exposé dans le dialog. `NewTaskDialog` charge désormais la liste des projets (`fetchProjects()`) à l'ouverture et propose un sélecteur optionnel.

Prop `defaultProjectId` ajoutée pour pré-remplir le projet depuis une page contexte (ex. onglet tasks d'un projet).

Fichier modifié : `ui/src/features/tasks/NewTaskDialog.tsx`

### Sélecteur de statut initial (À faire / Backlog)

À la *création* uniquement (pas à l'édition), un sélecteur permet de choisir entre `pending` (À faire, défaut) et `backlog`. Remplace le défaut codé en dur `status: 'pending'` dans `createTask()`.

Fichier modifié : `ui/src/features/tasks/NewTaskDialog.tsx`

### Tâche privée (`is_private`)

Champ `is_private` déjà présent sur le modèle, désormais exposé dans l'UI :

- **Modale :** checkbox "Tâche privée (visible uniquement par moi)" dans `NewTaskDialog`.
- **Carte :** badge cadenas affiché sur les tâches privées dans `TaskCard`.
- **Filtre :** bouton cadenas dans l'en-tête de `TasksPage` pour afficher uniquement ses tâches privées (filtre frontend).

Fichiers modifiés :
- `ui/src/features/tasks/NewTaskDialog.tsx`
- `ui/src/features/tasks/TaskCard.tsx`
- `ui/src/features/tasks/TasksPage.tsx`

### Date de complétion affichée

Sur les tâches `done`, la date de `completed_at` est maintenant affichée à côté du nom du compléteur (ex. *"Done by Alice · 18/03/2026"*).

Fichier modifié : `ui/src/features/tasks/TaskCard.tsx`

### Tri par priorité

Dans chaque section de `TasksPage`, les tâches sont triées par priorité décroissante (Haute → Normale → Basse → sans priorité). Tri frontend via une fonction `sortByPriority()` appliquée à chaque groupe de `useMemo`.

Fichier modifié : `ui/src/features/tasks/TasksPage.tsx`

### Onglet Tasks dans ProjectDetailPage

L'onglet "Tasks" du détail projet affichait des interactions de type `todo` (ancien système). Il est remplacé par un composant `TaskTabContent` qui :

- charge les tâches liées au projet via `GET /tasks/tasks/?project=<id>` (nouveau helper `fetchProjectTasks`)
- affiche chaque tâche avec `TaskCard` (transitions de statut, suppression avec undo, édition)
- sépare visuellement les tâches actives des tâches terminées
- ouvre `NewTaskDialog` avec le projet pré-rempli via `defaultProjectId`

Fichiers modifiés :
- `ui/src/features/projects/ProjectDetailPage.tsx`
- `ui/src/features/tasks/hooks.ts` — ajout de `useProjectTasks(projectId)`
- `ui/src/lib/api/tasks.ts` — ajout de `fetchProjectTasks(projectId)`

---

## Décisions techniques

- **Soft delete via `archived`** plutôt qu'un champ `deleted_at` dédié : le statut `archived` existait déjà, le filtre `useTasks()` l'excluait déjà, aucune migration nécessaire.
- **Restriction créateur via `perform_destroy()`** côté backend plutôt que côté frontend uniquement : le frontend masque le bouton mais le backend reste la source de vérité.
- **Chargement des projets dans `NewTaskDialog`** fusionné avec le chargement des zones dans un seul `Promise.all` pour ne pas rallonger le temps d'affichage.
- **Tri priorité uniquement frontend** : l'API reste ordonnée par `due_date, created_at`. Le tri priorité est appliqué après le regroupement par section, sans requête supplémentaire.
- **`isCreator` dans `TaskCard`** compare `String(task.created_by)` et `String(user.id)` pour absorber la différence de type entre le PK Django (integer) et l'ID auth frontend (string).

---

## État après session

| Fonctionnalité | Statut |
|---|---|
| Lier un projet dans la modale | ✅ |
| Attribuer à un membre | ✅ (déjà existant, vérifié) |
| Fait par + date | ✅ |
| Nouvelle tâche depuis projet | ✅ |
| Soft delete (archive) | ✅ |
| Créateur uniquement peut supprimer | ✅ |
| Priorités triées (haute en haut) | ✅ |
| Toast de suppression | ✅ corrigé |
| Flash empty state | ✅ corrigé |
| Statut par défaut à la création | ✅ (sélectable : À faire / Backlog) |
| Tâches privées dans l'UI | ✅ |
| Icône calendrier dark mode | ✅ corrigé |
| Transition en cours → done | ➡ inchangée (workflow bouton avancer) |
| `is_permanent` en cours | ➡ non traité (à réfléchir) |
