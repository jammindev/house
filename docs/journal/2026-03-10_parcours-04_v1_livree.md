# 2026-03-10 — Parcours 04 V1 livrée

## Contexte

Implémentation complète du parcours 04 — Suivre un projet de travaux ou de maintenance de bout en bout.

Objectif : faire du projet un vrai point de coordination actionnable, pas seulement un conteneur passif.

## Ce qui a été livré

### Lot 0 — Création rapide depuis le détail projet

Chaque onglet du détail projet expose maintenant un bouton de création rapide avec le contexte pré-établi.

- bouton `Ajouter une tâche` dans l'onglet Tâches → `/app/interactions/new/?type=todo&project_id=<id>&zone_ids=<...>`
- bouton `Ajouter une note` dans l'onglet Notes
- bouton `Ajouter une dépense` dans l'onglet Dépenses
- bouton `Ajouter une activité` dans l'onglet Timeline (sans type imposé, utilisateur choisit)
- `AppInteractionNewView.get_props()` détecte `project_id`, valide l'appartenance au household, charge les zones du projet et les pré-remplit
- `InteractionCreateForm.tsx` reçoit `initialProjectId` + `initialProjectTitle` et affiche un bandeau de contexte
- `project` inclus dans le payload de création de l'interaction
- redirection post-création vers la page projet avec `?tab=<onglet>` correspondant au type créé

### Lot 1 — Bloc de synthèse

Un bloc d'information actionnable s'affiche entre le header et les onglets de chaque projet.

- `ProjectSummaryBlock` : nombre de tâches ouvertes, tâches en retard (texte destructive), état du budget (réel / prévu / %)
- les tâches sont chargées via un hook `useInteractions(type='todo')` toujours monté (pas seulement quand l'onglet Tâches est actif)
- le bloc ne s'affiche pas si aucune donnée disponible (pas de budget ni de tâches)

### Lot 2 — Projet visible dans les vues filles

- `InteractionSerializer` expose un nouveau champ `project_title` (read-only, calculé depuis la FK)
- `TaskCard.tsx` affiche le nom du projet sous la zone, cliquable vers le détail du projet
- `InteractionList.tsx` affiche le nom du projet dans les métadonnées de chaque ligne, cliquable

### Sélecteur projet dans le formulaire de création

En dehors d'un contexte projet, l'utilisateur peut maintenant lier une interaction à un projet directement depuis le formulaire de création.

- chargement des projets actifs et en attente du household
- select dropdown affiché uniquement quand `initialProjectId` n'est pas déjà injecté
- `project` inclus dans le payload

### Lot 3 — Tests

Cinq nouveaux tests ajoutés.

`test_web_interactions.py` :
- `test_interaction_new_page_with_project_id` : props `initialProjectId`, `initialProjectTitle`, zones pré-remplies, redirection avec `?tab=tasks`
- `test_interaction_new_page_ignores_project_from_other_household` : isolation household

`test_api_interactions.py` :
- `test_create_interaction_with_project_links_correctly` : POST avec `project` lie l'interaction
- `test_list_interactions_filtered_by_project` : filtre `?project=<id>` retourne les bonnes interactions
- `test_patch_interaction_does_not_erase_project` : PATCH partiel sans `project` ne casse pas le lien

## Décisions techniques prises

- la création depuis le projet passe par l'URL (`?project_id=<id>`), pas un modal custom — cohérence avec les parcours 01-03
- les zones du projet sont lues côté Django depuis le modèle, pas depuis le query string
- le bloc de synthèse est calculé côté frontend depuis les données déjà chargées
- `project_title` ajouté dans `InteractionSerializer` comme champ calculé read-only — pas de migration
- la redirection post-création inclut `?tab=<onglet>` pour atterrir sur le bon onglet du projet
- le tab initial dans `ProjectDetail` est lu depuis l'URL (`?tab=`) avec un `useState` lazy initializer

## Définition de done validée

1. ✅ depuis la page détail d'un projet, une tâche peut être créée en moins de 3 clics avec le lien projet pré-établi
2. ✅ la tâche créée apparaît dans l'onglet Tâches du projet (redirection avec `?tab=tasks`)
3. ✅ le bloc de synthèse affiche les tâches ouvertes et l'état du budget
4. ✅ les tests couvrent la vue `AppInteractionNewView` avec `project_id`
5. ✅ le PATCH d'une interaction existante ne casse pas le lien projet
6. ✅ depuis une tâche ou une interaction, le nom du projet est visible et cliquable

## Références

- [docs/PARCOURS_04_SUIVRE_UN_PROJET_DE_BOUT_EN_BOUT.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_04_SUIVRE_UN_PROJET_DE_BOUT_EN_BOUT.md)
- [docs/PARCOURS_04_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_04_BACKLOG_TECHNIQUE.md)
