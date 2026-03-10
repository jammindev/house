# 2026-03-09 — Parcours 03 V1 livrée

## Contexte

Implémentation complète du parcours 03 — Transformer un besoin en action suivie.

Objectif de la session : livrer la V1 fonctionnelle du parcours tâches en remplacement du kanban existant, ouvrir les points d'entrée depuis les parcours 01 et 02, et corriger les bugs détectés pendant la livraison.

## Ce qui a été livré

### Refonte de la page tâches en liste mobile-first

La vue kanban a été entièrement remplacée par une liste verticale groupée par statut.

- `TasksPage.tsx` reconstruit avec un composant `TaskSection` collapsible
- sections dans l'ordre de priorité : En retard, En cours, À faire, Backlog (replié), Fait (replié)
- chips de filtre rapides en haut : Tout / À faire / En cours / Backlog / Fait
- sections vides masquées automatiquement
- `visibleBySection` calculé via `useMemo` pour éviter les incohérences entre sections

### Enrichissement de la carte tâche

`TaskCard.tsx` reconstruit avec :

- zone principale visible sur la carte
- date relative (`dans 2 jours`, `il y a 3 jours`) via `Intl.RelativeTimeFormat`
- badge En retard orange si date dépassée et statut non final
- indicateur lien événement source (icône Link) si `metadata.source_interaction_id` présent
- indicateur lien document (icône FileText) si `document_count > 0`
- bouton ✓ pour avancer au statut suivant (masqué pour les tâches faites)
- bouton undo (RotateCcw) uniquement pour les tâches au statut `done`
- bouton édition (Pencil)

### Édition d'une tâche après création

`NewTaskDialog.tsx` étendu pour supporter le mode édition :

- props `existingTask` et `onUpdated` ajoutées
- préremplissage via `useEffect` sur `[open, existingTask?.id]`
- PATCH vers `/api/interactions/interactions/<id>/` en mode édition
- deux instances du dialog dans `TasksPage` : une pour créer, une pour éditer

### Création depuis un événement (pont parcours 01 → 03)

- bouton `Créer une tâche` ajouté dans `InteractionList.tsx`
- navigation vers `/app/interactions/new/?type=todo&source_interaction_id=<id>`
- `AppInteractionNewView.get_props()` charge l'événement source et retourne `sourceInteraction` et `initialZoneIds`
- `InteractionCreateForm.tsx` affiche un bandeau de contexte avec l'événement source
- `source_interaction_id` stocké dans `metadata` à la création

### Création depuis un document (pont parcours 02 → 03)

- bouton `Créer une tâche` ajouté dans `DocumentDetailPage.tsx`
- `AppDocumentDetailView.get_props()` retourne `createTaskUrl` avec `source_document_id`
- le formulaire crée le lien `InteractionDocument` à la création

### Corrections de bugs pendant la livraison

**Double titre et bouton d'ajout** : le bloc Header de `TasksPage.tsx` dupliait ce que le template Django rendait déjà. Retiré.

**Bouton "New task" en anglais** : les fichiers `.po` avaient des traductions `fuzzy` résiduelles de l'ancienne chaîne "Open tasks". Corrigé dans les 4 locales (fr, en, de, es), `compilemessages` exécuté.

**Modale d'édition non préremplie** : le préremplissage dépendait d'un handler `handleDialogOpenChange(true)` qui n'était jamais appelé depuis l'extérieur. Remplacé par un `useEffect` sur `[open, existingTask?.id]`.

**En cours et Backlog avec les mêmes tâches** : quatre causes identifiées et corrigées :
1. `TaskStatus` ne contenait pas `'backlog'` — ajouté
2. `isTaskOverdue` comparait datetime au lieu de date seule — corrigé avec `setHours(0,0,0,0)`
3. absence de `key` props sur les `TaskSection` — corrigé
4. logique `getSectionTasks` confuse — remplacée par `visibleBySection` useMemo

**Bouton undo sur des tâches non finales** : `canGoBack` autorisait l'undo sur pending et in_progress. Corrigé à `canGoBack = task.status === 'done'` uniquement.

## Tests backend ajoutés

Deux nouveaux tests dans `apps/interactions/tests/test_web_interactions.py` :

- `test_interaction_new_page_with_source_interaction_id` : vérifie `sourceInteraction`, `initialZoneIds`, `defaultType='todo'`
- `test_interaction_new_page_with_type_todo_and_source_document` : vérifie `defaultType='todo'` et `linkedDocumentIds`

Les 5 tests du fichier passent.

## Décisions techniques prises

- le lien événement → tâche passe par `metadata.source_interaction_id` (JSONField, sans migration)
- la détection de retard reste côté frontend via `isTaskOverdue` sur `occurred_at`
- `NewTaskDialog` est réutilisé pour l'édition plutôt que de créer un second composant
- `TaskColumn.tsx` peut être retiré (rendu obsolète par `TaskSection`)

## Références

- [docs/PARCOURS_03_TRANSFORMER_UN_BESOIN_EN_ACTION_SUIVIE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_03_TRANSFORMER_UN_BESOIN_EN_ACTION_SUIVIE.md)
- [docs/PARCOURS_03_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_03_BACKLOG_TECHNIQUE.md)
