# Parcours 04 — Backlog technique V1

Ce document traduit la décision produit du parcours 04 en backlog technique concret pour le repo actuel.

Flow cible :

1. créer un projet depuis la page projets ou le dashboard
2. créer une tâche ou une note directement depuis le contexte du projet
3. voir la synthèse du projet : tâches ouvertes, budget, dernière activité
4. voir le projet depuis une tâche ou une interaction liée
5. clôturer le projet sans perdre l'historique

## Objectif d'implémentation

Enrichir le module projets existant pour en faire un vrai point de coordination actionnable.

Le modèle de données et l'API REST sont déjà en place. L'objectif n'est pas de refondre l'existant mais d'ouvrir les points d'entrée manquants : création depuis le projet, transmission du contexte projet au formulaire d'interaction, et affichage du projet dans les vues filles.

Les surfaces concernées sont :

- la page détail projet (ajout de boutons de création et d'un bloc de synthèse)
- le formulaire de création d'interaction (support du paramètre `project_id`)
- la vue Django `AppInteractionNewView` (transmission du contexte projet)
- la carte tâche et la liste interactions (affichage du projet si lié)

## État de réalisation au 2026-03-10

### Déjà en place et réutilisable

- modèle `Project` avec tous les champs nécessaires dans [apps/projects/models.py](/Users/benjaminvandamme/Developer/house/apps/projects/models.py)
- `ProjectZone`, `UserPinnedProject`, `ProjectGroup`, `ProjectAIThread`
- CRUD complet via `AppProjectsView`, `AppProjectsNewView`, `AppProjectsDetailView`, `AppProjectsEditView`
- `ProjectDetail.tsx` avec 7 onglets dont Tâches, Notes, Dépenses, Documents, Timeline, Métriques
- `ProjectList.tsx` avec recherche, filtres et épinglage
- `ProjectForm.tsx` avec tous les champs
- `ProjectCard.tsx` avec budget bar et indicateurs
- endpoint API `/api/projects/projects/` avec pin/unpin
- lecture des interactions par projet via `/api/interactions/interactions/?project=<id>`
- champ `project` FK sur `Interaction` — le lien est possible, mais non transmis depuis le contexte

### À construire

- boutons de création rapide dans les onglets du détail projet
- transmission du `project_id` vers `AppInteractionNewView` et `InteractionCreateForm`
- affichage du projet dans `TaskCard` et `InteractionList`
- bloc de synthèse en tête du détail projet

## Principe d'exécution

Le backlog est organisé en lots techniques verticaux.

Chaque lot produit un incrément testable.

## Décisions de cadrage MVP réalisable

Pour rendre cette V1 livrable sans refactoring lourd, ce backlog fixe les décisions suivantes :

- le modèle `Project` existant est suffisant, pas de migration de schema
- la création depuis le projet suit le pattern existant des parcours 01-03 : navigation vers `/app/interactions/new/` avec paramètres query string
- le champ `project` sur `Interaction` est transmis via `?project_id=<id>` dans l'URL
- le bloc de synthèse est calculé côté frontend à partir des données déjà chargées par les onglets
- les contacts/structures du projet sont vus en lecture seule via les interactions existantes
- l'affichage du projet dans les cartes tâche et les lignes interaction est optionnel en V1 si le scope est trop large

## Lot 0 — Création rapide depuis le détail projet

### But

Permettre de créer une tâche, une note ou une activité directement depuis la page détail d'un projet, avec le lien au projet pré-établi.

### Fichiers principaux

- [apps/projects/react/ProjectDetail.tsx](/Users/benjaminvandamme/Developer/house/apps/projects/react/ProjectDetail.tsx)
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)
- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx)

### Tâches

1. Dans `ProjectDetail.tsx`, ajouter un bouton `Ajouter une tâche` dans le rendu de l'onglet `tasks`.
2. Faire pointer ce bouton vers `/app/interactions/new/?type=todo&project_id=<projectId>&zone_ids=<zoneId,...>`.
3. Même pattern pour l'onglet `notes` : bouton `Ajouter une note` → `/app/interactions/new/?type=note&project_id=<projectId>`.
4. Dans `AppInteractionNewView.get_props()`, détecter le paramètre `project_id` et charger le projet.
5. Retourner `initialProjectId` et `initialProjectTitle` dans les props.
6. Dans `InteractionCreateForm.tsx`, accepter `initialProjectId` et `initialProjectTitle` comme props.
7. Stocker `project_id` dans le payload de création de l'interaction.
8. Afficher un bandeau de contexte projet dans le formulaire (similaire au bandeau `sourceInteraction` du parcours 03).

### Décision sur le champ `project` au niveau API

Le `PATCH /api/interactions/interactions/` accepte déjà un champ `project` (FK UUID).

Vérifier dans `InteractionSerializer` que `project` est en écriture. Si le champ est read-only ou absent, l'exposer en write dans le serializer.

### Critères de validation

- depuis l'onglet Tâches d'un projet, un clic sur `Ajouter une tâche` ouvre le formulaire avec le projet pré-lié
- la tâche créée apparaît dans l'onglet Tâches du projet
- depuis l'onglet Notes, même comportement pour `Ajouter une note`
- le projet ne doit pas être écrasé si l'utilisateur édite une interaction existante liée à ce projet

## Lot 1 — Bloc de synthèse en tête du détail projet

### But

Afficher une synthèse actionnable au-dessus des onglets : tâches ouvertes, tâches en retard, état du budget.

### Fichiers principaux

- [apps/projects/react/ProjectDetail.tsx](/Users/benjaminvandamme/Developer/house/apps/projects/react/ProjectDetail.tsx)

### Tâches

1. Dans `ProjectDetail.tsx`, ajouter un bloc `ProjectSummary` ou un composant inline entre le header et les onglets.
2. Le bloc est calculé depuis les données déjà disponibles (projet chargé via `fetchProject`, tâches non encore chargées).
3. Option A (simple) : afficher seulement les métriques budget depuis les données du projet (`planned_budget`, `actual_cost_cached`) et les dates.
4. Option B (plus riche) : charger en parallèle les tâches `type=todo` du projet pour calculer le nombre de tâches ouvertes et en retard — utiliser `useInteractions` qui existe déjà.
5. Recommandation V1 : option B car les données sont déjà disponibles via le hook `useInteractions` et les onglets les chargent de toute façon.

### Notes techniques

- `isTaskOverdue` existe dans `ui/src/lib/api/tasks.ts` — réutilisable pour le calcul frontend.
- La synthèse ne doit pas dupliquer l'onglet Métriques mais le compléter avec une vue orientée "quoi faire".
- Si les tâches ne sont chargées que dans l'onglet actif (lazy), déclencher le chargement à l'ouverture pour alimenter la synthèse également.

### Critères de validation

- le bloc de synthèse affiche le nombre de tâches ouvertes et en retard
- le budget affiché est correct si renseigné
- le bloc ne s'affiche pas ou est minimal si aucune donnée n'est disponible
- la page reste lisible sur mobile avec le bloc en tête

## Lot 2 — Affichage du projet dans les vues filles (optionnel V1)

### But

Montrer depuis une tâche ou une interaction à quel projet elle appartient.

### Fichiers principaux

- [apps/tasks/react/TaskCard.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskCard.tsx)
- [ui/src/lib/api/tasks.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/tasks.ts)
- [apps/interactions/react/InteractionList.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionList.tsx)

### Tâches

1. Vérifier que l'endpoint `/api/interactions/interactions/?type=todo` expose le champ `project` (id) et/ou `project_title` dans `InteractionSerializer`.
2. Si non, ajouter le champ `project_title` comme champ calculé read-only dans `InteractionSerializer`.
3. Mettre à jour l'interface `Task` dans `tasks.ts` pour inclure `project_title?: string | null`.
4. Dans `TaskCard.tsx`, afficher le nom du projet sous la zone si présent — ligne discrète, texte muted.
5. Rendre le nom du projet cliquable vers `/app/projects/<id>/` si le champ `project` (id) est disponible.
6. Même traitement dans `InteractionList.tsx` pour les lignes d'interaction.

### Décision de priorisation

Ce lot est le moins bloquant pour la valeur utilisateur immédiate du parcours 04. Si le lot 0 et le lot 1 sont livrés, ce lot peut être reporté sans compromettre le parcours.

### Critères de validation

- une tâche liée à un projet affiche le nom du projet dans sa carte
- un clic sur le nom du projet navigue vers la page détail du projet
- une tâche sans projet n'affiche pas de ligne projet vide

## Lot 3 — Tests et validation manuelle

### But

Sécuriser les nouveaux flux sans multiplier les tests inutiles.

### Fichiers principaux

- [apps/interactions/tests/test_web_interactions.py](/Users/benjaminvandamme/Developer/house/apps/interactions/tests/test_web_interactions.py)
- [apps/projects/tests/](/Users/benjaminvandamme/Developer/house/apps/projects/tests/) si existant

### Tâches

1. Ajouter un test web pour `AppInteractionNewView` avec `project_id` en paramètre.
   - Vérifier que `initialProjectId` et `initialProjectTitle` sont dans les props retournées.
   - Vérifier que le projet appartient bien au household de l'utilisateur (accès autorisé uniquement).
2. Vérifier que le `POST /api/interactions/interactions/` avec `project` (FK UUID) crée bien l'interaction liée au projet.
3. Vérifier que la liste `/api/interactions/interactions/?project=<id>` retourne bien les interactions de ce projet.
4. Vérifier que le `PATCH` partiel d'une interaction ne casse pas le lien projet existant.

### Validation manuelle minimale

1. créer un projet "Test parcours 04" avec statut actif
2. depuis l'onglet Tâches, créer une tâche "Tâche de test" liée au projet
3. vérifier que la tâche apparaît dans l'onglet Tâches du projet
4. ouvrir la liste globale des tâches et vérifier que la tâche apparaît avec le projet
5. depuis l'onglet Notes, créer une note liée au projet
6. vérifier que la note apparaît dans l'onglet Notes du projet
7. vérifier que la synthèse reflète 1 tâche ouverte
8. marquer la tâche comme faite
9. vérifier que la synthèse se met à jour (0 tâche ouverte)
10. marquer le projet comme `completed` — vérifier que tout reste lisible

## Ordre recommandé d'implémentation

1. Lot 0 — Création rapide depuis le projet (point d'entrée principal du parcours)
2. Lot 1 — Bloc de synthèse (valeur immédiate pour l'utilisateur)
3. Lot 3 — Tests (sécurisation des flux)
4. Lot 2 — Affichage du projet dans les vues filles (amélioration progressive)

## Découpage en sessions de travail

### Session 1

- Lot 0 : création rapide depuis le détail projet
  - côté backend : `AppInteractionNewView` + `project_id`
  - côté frontend : boutons dans `ProjectDetail.tsx` + props dans `InteractionCreateForm`

### Session 2

- Lot 1 : bloc de synthèse
- Lot 3 : tests et validation manuelle

### Session 3 (optionnel)

- Lot 2 : affichage du projet dans les vues filles

## Points de vigilance

- ne pas envoyer `project=null` dans le payload PATCH si le champ projet n'est pas modifié — risque d'écraser un lien existant
- vérifier que `project` est bien un champ writable dans `InteractionSerializer` avant d'implémenter le frontend
- le `project_id` dans l'URL query string doit être validé côté Django : le projet doit appartenir au household de l'utilisateur
- ne pas afficher de boutons de création dans les onglets si la page est en lecture seule (ex : projet `completed` ou `cancelled`) — à décider en V1
- ne pas dupliquer `useInteractions` : le hook est déjà dans `ProjectDetail.tsx`, l'utiliser comme source unique pour la synthèse et les onglets
- garder le vocabulaire cohérent avec les parcours précédents : ne pas introduire de nouveaux mots-clés pour ce qui existe déjà (`activité`, `tâche`, `document`)

## Définition de done technique

La V1 peut être considérée terminée si :

1. depuis la page détail d'un projet, une tâche peut être créée en moins de 3 clics avec le lien projet pré-établi
2. la tâche créée apparaît dans l'onglet Tâches du projet sans rechargement manuel
3. le bloc de synthèse affiche les tâches ouvertes et l'état du budget
4. les tests couvrent la vue `AppInteractionNewView` avec `project_id`
5. le PATCH d'une interaction existante ne casse pas le lien projet
6. la page détail reste utilisable sur mobile
