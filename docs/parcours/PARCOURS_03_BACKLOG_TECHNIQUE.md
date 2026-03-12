# Parcours 03 — Backlog technique V1

Ce document traduit la décision produit du parcours 03 en backlog technique concret pour le repo actuel.

Flow cible :

1. refonte de la page tâches en liste mobile-first avec sections par statut
2. création d'une tâche standalone depuis la liste ou le dashboard
3. création d'une tâche depuis un événement existant avec lien d'origine
4. création d'une tâche depuis un document avec lien d'origine
5. affichage du contexte (zone, origine, retard) dans la carte tâche
6. édition d'une tâche après création
7. clôture propre sans perte de contexte

## Objectif d'implémentation

Reconstruire la page tâches en liste mobile-first et ouvrir les points d'entrée depuis les parcours 01 et 02, sans refactorer le modèle de données ni l'API existante.

Les surfaces concernées sont :

- la mini-app tasks à refondre côté React
- la page de détail document issue du parcours 02
- la liste interactions du parcours 01
- le formulaire de création d'interaction réutilisé comme formulaire de création de tâche

## État de réalisation au 2026-03-09

La mini-app tasks existe avec un kanban. La création standalone est opérationnelle.

Considérés comme déjà couverts et réutilisables :

- vue Django `AppTasksView` dans [apps/tasks/views_web.py](/Users/benjaminvandamme/Developer/house/apps/tasks/views_web.py)
- route `/app/tasks/`
- composant `NewTaskDialog.tsx` (conservé tel quel)
- composant `TaskCard.tsx` (à adapter)
- client frontend `tasks.ts` avec `fetchTasks`, `updateTaskStatus`, `createTask`
- endpoint API `/api/interactions/interactions/tasks/`
- endpoint `update_status`
- CRUD complet

À remplacer ou retirer :

- `TasksPage.tsx` kanban → reconstruit en liste mobile-first
- `TaskColumn.tsx` → remplacé par un composant de section de liste, peut être retiré

## Principe d'exécution

Le backlog est organisé en lots techniques verticaux.

Chaque lot produit un incrément testable.

## Décisions de cadrage MVP réalisable

Pour rendre cette V1 livrable sans refactoring lourd, ce backlog fixe les décisions suivantes :

- les tâches restent des `Interaction` avec `type='todo'`, pas un modèle séparé
- la page tâches est reconstruite en liste, le kanban est abandonné
- `TaskColumn.tsx` peut être retiré, `TaskCard.tsx` est conservé et adapté
- le lien entre une tâche et son document source est géré via `InteractionDocument`
- le lien entre une tâche et son événement source est stocké dans le champ `metadata` en V1
- la détection des tâches en retard est calculée côté frontend sur `occurred_at`
- l'édition d'une tâche réutilise un dialog inline, pas une nouvelle page dédiée
- la vue détail tâche sur une page web dédiée sort du scope V1

## Lot 0 — Refonte de la page tâches en liste mobile-first

### But

Remplacer le kanban par une liste groupée par statut, utilisable sur mobile sans friction.

### Fichiers principaux

- [apps/tasks/react/TasksPage.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TasksPage.tsx) — refonte complète
- [apps/tasks/react/TaskColumn.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskColumn.tsx) — à retirer
- [apps/tasks/react/TaskCard.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskCard.tsx) — à adapter
- [ui/src/lib/api/tasks.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/tasks.ts)
- [ui/src/pages/tasks/index.tsx](/Users/benjaminvandamme/Developer/house/ui/src/pages/tasks/index.tsx) si existant

### Tâches

1. Réécrire `TasksPage.tsx` pour afficher une liste verticale à la place des colonnes.
2. Créer un composant `TaskSection` (ou équivalent) qui remplace `TaskColumn` : titre de section, nombre de tâches, liste de cartes.
3. Implémenter l'ordre des sections dans la page :
   - `En retard` (visible uniquement si des tâches en retard existent)
   - `En cours` (`in_progress`)
   - `À faire` (`pending`)
   - `Backlog` (`backlog`) — replié par défaut
   - `Fait` (`done`) — replié par défaut
4. Ajouter des chips de filtre en en-tête : `Tout`, `À faire`, `En cours`, `Backlog`, `Fait`.
5. Masquer les sections vides sauf si elles correspondent au filtre actif.
6. Conserver le bouton `+ Ajouter` visible en haut sans scroll.
7. Retirer `TaskColumn.tsx` ou le marquer comme obsolète.

### Notes techniques

- L'endpoint existant `/api/interactions/interactions/tasks/` retourne déjà les tâches groupées par statut (`{backlog: [], pending: [], in_progress: [], done: []}`). Ce format peut être conservé ou aplati en une liste simple re-triée côté frontend.
- Le calcul des tâches en retard reste pur frontend : `occurred_at < now` et status non final.
- Le filtre actif peut être synchronisé dans l'URL via un query param `?status=pending` pour permettre le deep-link.

### Critères de validation

- la page s'affiche sans scroll horizontal sur une largeur de 375px
- les sections `Backlog` et `Fait` sont repliées par défaut
- les sections vides ne s'affichent pas en mode `Tout`
- les chips de filtre fonctionnent et réduisent la liste au statut sélectionné
- la création rapide via `NewTaskDialog` reste fonctionnelle

## Lot 1 — Création de tâche depuis un événement

### But

Ouvrir un point d'entrée depuis la liste interactions pour créer une tâche liée à un événement existant.

### Fichiers principaux

- [apps/interactions/react/InteractionList.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionList.tsx)
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)
- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx)
- [apps/interactions/serializers.py](/Users/benjaminvandamme/Developer/house/apps/interactions/serializers.py)
- [ui/src/lib/api/interactions.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/interactions.ts)

### Tâches

1. Ajouter une action `Créer une tâche` sur les cartes ou lignes de la liste interactions.
2. Naviguer vers `/app/interactions/new/?type=todo&source_interaction_id=<id>`.
3. Dans `AppInteractionNewView`, détecter le paramètre `source_interaction_id` et charger l'événement source.
4. Préremplir le sujet de la tâche à partir du sujet de l'événement source si disponible.
5. À la création de la tâche, stocker `source_interaction_id` dans `metadata`.
6. Préremplir la zone depuis l'événement source pour réduire la friction.

### Décision V1 sur le stockage du lien événement→tâche

Le modèle `Interaction` n'a pas de FK vers une autre `Interaction`.

Options en V1 :

- **Option retenue :** stocker `source_interaction_id` dans `metadata` (JSONField déjà présent). Simple, sans migration.
- Option future : créer un modèle `InteractionLink` si plusieurs parcours en ont besoin.

Le lien reste lisible et interrogeable côté frontend via `metadata.source_interaction_id`.

### Critères de validation

- un utilisateur peut déclencher la création d'une tâche depuis un événement de la liste
- le formulaire s'ouvre avec le type `todo` et le sujet prérempli si disponible
- la tâche créée contient le lien vers l'événement source dans ses métadonnées
- la tâche apparaît dans la liste

## Lot 2 — Création de tâche depuis un document

### But

Réutiliser le flux du parcours 02 (lot 5) pour créer une tâche liée à un document.

### Fichiers principaux

- [apps/documents/react/DocumentDetailPage.tsx](/Users/benjaminvandamme/Developer/house/apps/documents/react/DocumentDetailPage.tsx)
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)
- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx)
- [ui/src/lib/api/interactions.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/interactions.ts)

### Tâches

1. Ajouter une action `Créer une tâche` dans le détail document, en complément de `Créer une activité`.
2. Naviguer vers `/app/interactions/new/?type=todo&source_document_id=<id>`.
3. Le paramètre `source_document_id` est déjà géré dans `AppInteractionNewView`.
4. Le formulaire s'ouvre avec le type forcé à `todo` et la zone préremplie si possible.
5. À la création, le lien `InteractionDocument` est créé entre la tâche et le document source.
6. Après création, retour vers le détail document avec la tâche visible dans les activités liées.

### Notes techniques

- Ce lot est très proche du lot 5 du parcours 02. Le flux serveur `AppInteractionNewView` gère déjà `source_document_id`.
- La seule différence est le forçage du type à `todo` et l'éventuel préremplissage adapté.
- Vérifier que `source_document_id` dans la vue web ne conflit pas avec un paramètre nommé différemment.

### Critères de validation

- une action `Créer une tâche` est visible dans le détail document
- le formulaire s'ouvre avec le type `todo` et les informations utiles préremplies
- la tâche est créée et liée au document via `InteractionDocument`
- le retour vers le document montre la tâche dans les activités liées

## Lot 3 — Enrichissement de la carte tâche

### But

Afficher dans la carte tâche la zone, les liens d'origine et le signal de retard.

### Fichiers principaux

- [apps/tasks/react/TaskCard.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskCard.tsx)
- [ui/src/lib/api/tasks.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/tasks.ts)
- [apps/interactions/views.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views.py)
- [apps/interactions/serializers.py](/Users/benjaminvandamme/Developer/house/apps/interactions/serializers.py)

### Tâches

1. Vérifier que le payload de l'endpoint `/api/interactions/interactions/tasks/` expose :
   - les zones liées (`zone_names` ou `zones_detail`)
   - les documents liés (`linked_document_ids` ou `document_count`)
   - les métadonnées (pour `source_interaction_id`)
2. Mettre à jour le client frontend `tasks.ts` si de nouveaux champs doivent être lus.
3. Mettre à jour `TaskCard.tsx` pour afficher :
   - la zone principale (première zone ou la seule)
   - un indicateur discret si un document est lié (icône avec lien)
   - un indicateur discret si un événement source existe dans `metadata` (icône avec lien)
   - un badge ou surlignage rouge/orange si la tâche est en retard
   - un bouton ✓ inline pour avancer au statut suivant
4. Rendre les indicateurs de contexte cliquables pour naviguer vers la source.

### Notes techniques

- Les champs `zone_names`, `linked_document_ids` et `metadata` sont déjà exposés par `InteractionSerializer`.
- Vérifier que l'endpoint `/tasks/` (action custom sur le `ViewSet`) sérialise bien avec ces champs. S'il utilise un serializer allégé, l'aligner avec `InteractionSerializer`.
- La détection de retard : `new Date(task.occurred_at) < new Date()` et `task.status` ni `done` ni `archived`.
- Le bouton ✓ appelle `updateTaskStatus` existant dans `tasks.ts`.

### Critères de validation

- la carte affiche la zone de la tâche
- la carte affiche un indicateur si un document est lié
- la carte affiche un indicateur si un événement source est dans les métadonnées
- les tâches en retard sont visuellement distinguées des autres
- le bouton ✓ change le statut sans recharger toute la page
- la carte reste lisible et non surchargée

## Lot 4 — Édition d'une tâche après création

### But

Permettre de modifier une tâche sans avoir à la supprimer et la recréer.

### Fichiers principaux

- [apps/tasks/react/TaskCard.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskCard.tsx)
- [apps/tasks/react/TasksPage.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TasksPage.tsx)
- [apps/interactions/views.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views.py)
- [ui/src/lib/api/tasks.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/tasks.ts)
- [ui/src/lib/api/interactions.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/interactions.ts)

### Tâches

1. Ajouter une action d'édition accessible depuis la carte (bouton ou menu discret).
2. Ouvrir un dialog inline dans la page tâches avec les champs éditables.
3. Implémenter le formulaire d'édition minimal : sujet, date occurrence, notes/contenu, zone.
4. PATCH vers `/api/interactions/interactions/<id>/` avec uniquement les champs modifiés.
5. Rafraîchir la carte concernée sans recharger toute la liste.
6. S'assurer que les liens existants (`InteractionDocument`, zones, métadonnées) ne sont pas écrasés.

### Notes techniques

- L'API supporte déjà le PATCH sur une interaction.
- La zone est obligatoire côté backend ; le formulaire d'édition doit la conserver.
- Pour éviter d'écraser les liens, n'envoyer dans le PATCH que les champs du formulaire d'édition, pas une reconstruction complète du payload.
- Le dialog d'édition peut être proche de `NewTaskDialog` — envisager de le factoriser si les champs sont identiques.

### Critères de validation

- une action d'édition est accessible depuis la carte
- les champs sujet, date, notes et zone sont modifiables
- la sauvegarde est persistée côté API
- la liste reflète les changements sans rechargement complet
- les liens existants (documents, zones, métadonnées) sont conservés après édition

## Lot 5 — Tests et validation manuelle

### But

Sécuriser les flux sans multiplier les tests inutiles.

### Fichiers principaux

- [apps/interactions/tests/test_web_interactions.py](/Users/benjaminvandamme/Developer/house/apps/interactions/tests/test_web_interactions.py)
- tests API interactions existants

### Tâches

1. Ajouter un test web pour la vue `AppInteractionNewView` avec `source_interaction_id` en paramètre.
2. Ajouter un test web pour la vue `AppInteractionNewView` avec `source_document_id` et `type=todo`.
3. Vérifier que le `PATCH` d'une interaction `todo` via l'API conserve les zones et documents liés.
4. Vérifier le payload de l'endpoint `/tasks/` avec les champs enrichis attendus par la carte.

### Validation manuelle minimale

1. ouvrir la page tâches sur mobile ou vue étroite — vérifier l'absence de scroll horizontal
2. créer un événement depuis le dashboard
3. depuis la liste interactions, créer une tâche liée à cet événement
4. vérifier que la tâche apparaît dans la liste avec le lien vers l'événement
5. ouvrir un document et créer une tâche liée
6. vérifier que le document est visible dans la carte de la tâche
7. éditer le sujet de la tâche
8. faire avancer les tâches jusqu'à `Fait` via le bouton ✓
9. confirmer que les liens d'origine sont encore lisibles après clôture

## Ordre recommandé d'implémentation

1. Lot 0 — Refonte page tâches en liste (base structurelle de tout le reste)
2. Lot 3 — Enrichissement de la carte (zone, indicateurs, retard)
3. Lot 1 — Création depuis un événement (pont parcours 01 → 03)
4. Lot 2 — Création depuis un document (pont parcours 02 → 03)
5. Lot 4 — Édition de tâche
6. Lot 5 — Tests et validation

## Découpage en sessions de travail

### Session 1

- Lot 0 : refonte de la page en liste
- Lot 3 : enrichissement de la carte

### Session 2

- Lot 1 : création depuis un événement
- Lot 2 : création depuis un document

### Session 3

- Lot 4 : édition de tâche
- Lot 5 : tests et validation manuelle

## Points de vigilance

- ne pas créer un modèle tâche séparé : la cohérence avec la timeline et les liens existants dépend du modèle `Interaction`
- ne pas écraser les zones ou documents liés lors d'un PATCH partiel via le formulaire d'édition
- ne pas ouvrir les liens bidirectionnels trop tôt : en V1, le lien `événement → tâche` via `metadata` est suffisant
- ne pas exposer le statut `archived` dans la liste : filtrer explicitement côté frontend
- ne pas dupliquer le formulaire d'édition : vérifier si `NewTaskDialog` peut être étendu plutôt qu'un second composant créé
- garder le vocabulaire cohérent avec le parcours 01 (`activité`, `historique`) et le parcours 02 (`document`, `relier`)
- vérifier que l'endpoint `/tasks/` sérialise bien tous les champs nécessaires à la carte avant de chercher à enrichir le composant

## Définition de done technique

La V1 peut être considérée terminée si :

1. la page tâches s'affiche en liste verticale sans scroll horizontal sur mobile
2. les sections sont dans le bon ordre avec repli correct de `Backlog` et `Fait`
3. une tâche peut être créée depuis un événement existant avec le lien stocké
4. une tâche peut être créée depuis un document existant avec le lien `InteractionDocument` créé
5. la carte tâche affiche la zone, les indicateurs de contexte et le signal de retard
6. une tâche peut être éditée après création sans perdre ses liens
7. les tâches archivées ne s'affichent pas dans la liste
8. les tests essentiels couvrent les nouveaux points d'entrée
