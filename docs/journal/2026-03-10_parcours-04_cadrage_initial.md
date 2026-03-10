# 2026-03-10 — Parcours 04 cadrage initial

## Contexte

Début du travail sur le parcours 04 — Suivre un projet de travaux ou de maintenance de bout en bout.

Objectif de la session : cadrer le parcours en analysant l'état actuel du module projets, identifier les écarts avec le besoin utilisateur, et produire la documentation produit et technique avant implémentation.

## Analyse de l'existant

Le module projets est déjà substantiel :

- modèle `Project` complet (statut, type, priorité, dates, budget, zones, groupes, tags)
- CRUD opérationnel via les vues Django et les composants React
- `ProjectDetail.tsx` avec 7 onglets : description, tâches, notes, dépenses, documents, timeline, métriques
- liste filtrée avec épinglage dans `ProjectList.tsx`
- budget bar et indicateurs dans `ProjectCard.tsx`
- les interactions liées à un projet sont déjà lisibles via `/api/interactions/interactions/?project=<id>`

## Écart principal identifié

Le module projets est un bon conteneur en lecture mais un mauvais point d'entrée pour agir.

Les onglets du détail affichent bien les interactions liées, mais il n'existe aucun bouton pour en créer une depuis ce contexte. L'utilisateur doit naviguer vers la liste des interactions ou des tâches, créer l'élément, puis penser à le lier manuellement au bon projet.

Ce point de friction est le principal bloquer du parcours.

## Documentation produite

Deux documents créés pour cadrer l'implémentation :

- [docs/PARCOURS_04_SUIVRE_UN_PROJET_DE_BOUT_EN_BOUT.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_04_SUIVRE_UN_PROJET_DE_BOUT_EN_BOUT.md) — doc produit avec scénarios, règles, stories, recommandations d'interface et définition de done
- [docs/PARCOURS_04_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_04_BACKLOG_TECHNIQUE.md) — 4 lots techniques avec fichiers concernés, tâches précises et critères de validation

## Lots techniques définis

- **Lot 0** (priorité max) : boutons de création rapide dans les onglets du détail projet + transmission de `project_id` vers `AppInteractionNewView` et `InteractionCreateForm`
- **Lot 1** : bloc de synthèse actionnable en tête du détail projet (tâches ouvertes, budget)
- **Lot 2** (optionnel V1) : affichage du projet dans les cartes tâche et les lignes interaction
- **Lot 3** : tests backend et validation manuelle

## Prochaine étape

Implémenter le lot 0 : c'est le point d'entrée principal du parcours et le changement le plus visible pour l'utilisateur.

## Références

- [docs/PARCOURS_04_SUIVRE_UN_PROJET_DE_BOUT_EN_BOUT.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_04_SUIVRE_UN_PROJET_DE_BOUT_EN_BOUT.md)
- [docs/PARCOURS_04_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_04_BACKLOG_TECHNIQUE.md)
