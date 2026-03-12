# Parcours 04 — Suivre un projet de travaux ou de maintenance de bout en bout

Ce document détaille le quatrième parcours métier à travailler dans House.

Il s'appuie sur l'état actuel du projet Django + React hybride, sur le socle posé par le parcours 01 (capturer un événement), le parcours 02 (traiter un document entrant) et le parcours 03 (transformer un besoin en action suivie).

## Résumé

Le quatrième usage fondamental du produit est le suivant :

"Je veux avancer sur un chantier ou un sujet de fond sans perdre les infos dispersées."

Ce parcours est clé car il donne une cohérence à tout ce qui a été construit avant.

- Des événements, des tâches, des documents et des contacts se rapportent souvent à un même objectif.
- Sans point de coordination central, ces éléments restent éparpillés dans les différentes vues.
- Le projet est le conteneur naturel qui permet de les retrouver ensemble.

Sans ce parcours, le foyer a une bonne mémoire mais pas de vision d'ensemble sur un chantier ou un sujet de fond.

## Positionnement produit

## Concept interne

Le modèle technique central est `Project`.

Ce modèle existe déjà dans [apps/projects/models.py](/Users/benjaminvandamme/Developer/house/apps/projects/models.py) avec les champs suivants :

- `title`, `description`, `status`, `type`, `priority` (1-5)
- `start_date`, `due_date`, `closed_at`
- `planned_budget`, `actual_cost_cached`
- `tags`, `project_group`
- `zones` via `ProjectZone`
- `cover_interaction` (FK facultatif)

Les `Interaction` (événements, tâches, notes, dépenses) se lient à un projet via le champ `project` FK.

Les `Document` se lient via `InteractionDocument` ou directement via une interaction liée au projet.

Les contacts et structures se lient via `InteractionContact` et `InteractionStructure` dans les interactions du projet.

## Concept visible côté utilisateur

Dans l'interface, le vocabulaire à utiliser est :

- vue principale : `Projets`
- action principale : `Nouveau projet`
- statuts visibles : `Actif`, `En attente`, `Terminé`, `Annulé`
- types : `Rénovation`, `Maintenance`, `Réparation`, `Achat`, `Déménagement`, etc.
- formulation secondaire : `chantier`, `sujet de fond`, `dossier en cours`

Le mot `Project` reste dans le code. Le vocabulaire `interaction` reste invisible sur cette surface.

## Objectif produit

Permettre à un membre du foyer de :

1. créer un projet avec un intitulé, un type et un statut clairs
2. y rattacher rapidement des activités, des tâches, des notes et des documents depuis le contexte du projet
3. voir en un coup d'œil la synthèse du projet : tâches ouvertes, dernières activités, budget
4. lier les bons contacts ou prestataires depuis le projet
5. maintenir une vue d'avancement suffisamment simple pour décider de la suite

## Ce que le projet a déjà aujourd'hui

Le repo contient déjà une base solide pour ce parcours.

## Module projets existant

Un module projets complet existe dans [apps/projects/](/Users/benjaminvandamme/Developer/house/apps/projects/).

Il expose plusieurs pages accessibles via `/app/projects/` :

- liste des projets avec recherche, filtres par statut, type et groupe
- création d'un projet via un formulaire complet
- détail d'un projet avec onglets : description, tâches, notes, dépenses, documents, timeline, métriques
- édition d'un projet
- groupes de projets

Les composants React existants couvrent déjà les usages principaux :

- [apps/projects/react/ProjectList.tsx](/Users/benjaminvandamme/Developer/house/apps/projects/react/ProjectList.tsx) — liste filtrée avec épinglage
- [apps/projects/react/ProjectDetail.tsx](/Users/benjaminvandamme/Developer/house/apps/projects/react/ProjectDetail.tsx) — détail avec onglets
- [apps/projects/react/ProjectForm.tsx](/Users/benjaminvandamme/Developer/house/apps/projects/react/ProjectForm.tsx) — formulaire création/édition
- [apps/projects/react/ProjectCard.tsx](/Users/benjaminvandamme/Developer/house/apps/projects/react/ProjectCard.tsx) — carte avec budget bar et indicateurs

## API existante

- liste des projets : `/api/projects/projects/`
- détail d'un projet : `/api/projects/projects/{id}/`
- épinglage/désépinglage : `/api/projects/projects/{id}/pin/` et `unpin/`
- interactions liées : `/api/interactions/interactions/?project=<id>`
- groupes : `/api/projects/groups/`
- client frontend : [ui/src/lib/api/projects.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/projects.ts)

## Capacité métier déjà présente

- création d'un projet avec tous les champs essentiels
- 5 statuts disponibles : `draft`, `active`, `on_hold`, `completed`, `cancelled`
- 8 types disponibles dont renovation, maintenance, repair, purchase
- zones liées via `ProjectZone`
- groupes de projets via `ProjectGroup`
- budget prévisionnel et coût réel agrégé
- épinglage de projets
- onglets dans le détail : tâches, notes, dépenses, documents, timeline — lus via l'API interactions filtrée par projet

## Diagnostic actuel

Le module projets est bien structuré côté modèle et côté liste. Le détail lit déjà les interactions liées par onglet.

Cependant, deux problèmes bloquent la valeur métier du parcours.

Le premier est fonctionnel : depuis la page détail d'un projet, il n'est pas possible de créer une tâche, une note ou un document directement dans le contexte du projet. L'onglet "Tâches" affiche les tâches mais ne propose pas de bouton "Créer une tâche pour ce projet". L'utilisateur doit naviguer ailleurs, créer l'élément, puis penser à le lier manuellement au projet — ce qui n'est pas naturel.

Le second est structurel : les interactions créées depuis le formulaire d'interaction standard ne sont pas liées au projet par défaut. Le champ `project` existe sur le modèle, mais le formulaire de création d'interaction ne le reçoit pas en paramètre depuis le contexte projet.

Ce qui fonctionne :

- créer un projet et le consulter
- voir les interactions, tâches et dépenses d'un projet via les onglets
- filtrer les projets par statut, type, groupe
- suivre le budget via l'onglet métriques

Ce qui manque pour rendre le parcours vraiment fort :

- créer une tâche directement depuis le projet avec le lien pré-établi
- créer une note, une activité ou un document depuis le projet avec le lien pré-établi
- voir les contacts ou prestataires impliqués dans le projet
- avoir une synthèse actionnable : "voici les tâches ouvertes, voici la prochaine chose à faire"
- lier un projet depuis le formulaire de création d'une interaction
- voir le nom du projet dans une carte de tâche ou une ligne d'interaction

## Problème utilisateur précis

Quand l'utilisateur travaille sur un sujet de fond (rénover la salle de bain, gérer le contrat d'entretien, suivre un déménagement), il a besoin d'un point de coordination central.

Il ne doit pas avoir à :

- créer une interaction, puis chercher manuellement comment la rattacher à un projet
- naviguer dans la liste de projets pour retrouver où en est son chantier
- reconstruire mentalement quelles tâches sont en attente, quels documents sont liés, qui est le prestataire

Le projet doit devenir le point de départ naturel pour agir, pas seulement un conteneur passif.

## Utilisateur cible

Pour ce parcours, la cible principale est un membre du foyer qui pilote un sujet qui s'étend dans le temps.

Exemples :

- travaux de rénovation avec plusieurs intervenants, plusieurs factures, plusieurs visites
- contrat de maintenance annuel avec rappels, visites et documents à suivre
- achat immobilier ou déménagement avec une suite d'étapes longues
- grand ménage de printemps avec une liste de zones à traiter et des prestataires à appeler

## Scénarios prioritaires

## Scénario A — Créer un projet depuis un besoin identifié

"J'ai plusieurs tâches et documents qui s'accumulent autour de la rénovation de la salle de bain. Je veux créer un projet pour les centraliser."

## Scénario B — Agir depuis le contexte projet

"Je suis sur la page de mon projet de rénovation. Je veux ajouter une tâche 'Appeler le carreleur' sans quitter ce contexte."

## Scénario C — Voir la synthèse d'un projet en cours

"Je reprends le suivi d'un projet après quelques jours d'absence. Je veux voir en un coup d'œil ce qui s'est passé, ce qui reste à faire et où en est le budget."

## Scénario D — Rattacher une activité existante à un projet

"J'ai noté une activité sans la lier à un projet. Je veux maintenant l'associer au bon projet."

## Scénario E — Clôturer un projet avec son historique intact

"Le chantier est terminé. Je marque le projet comme terminé. Je veux pouvoir retrouver plus tard tout ce qui s'y rapporte."

## Parcours cible

Le parcours de référence pour la V1 est le suivant.

### Créer un projet et le peupler

1. L'utilisateur crée un projet depuis la page projets ou le dashboard.
2. Il lui donne un titre, un type, un statut initial et une zone si pertinent.
3. Depuis la page détail du projet, il crée une première tâche directement dans le contexte du projet.
4. Il peut ajouter une note ou un document de la même manière.
5. Tous ces éléments apparaissent dans les onglets correspondants du projet.

### Reprendre le fil d'un projet

1. L'utilisateur ouvre un projet depuis la liste.
2. Il voit la synthèse : tâches ouvertes, dernière activité, état du budget.
3. Il crée directement la prochaine action depuis cet écran.

### Clôturer un projet

1. L'utilisateur marque le projet comme `completed`.
2. Le projet reste consultable avec tout son historique.
3. Les tâches et interactions restent accessibles depuis le projet et depuis leurs vues respectives.

## Règles produit

## Règle 1 — Le projet est un conteneur, pas un workflow

Le projet ne remplace pas les tâches ou les interactions.

Il les agrège. Les tâches restent des `Interaction` avec `type='todo'`. Les notes restent des `Interaction` avec `type='note'`. Le projet est simplement le contexte qui les regroupe.

## Règle 2 — La création depuis le projet doit être sans friction

Créer une tâche ou une note depuis la page projet ne doit pas nécessiter de naviguer vers une autre section.

Le contexte projet (id, zones) doit être transmis automatiquement au formulaire de création.

## Règle 3 — Le lien projet doit rester visible dans les vues filles

Une tâche liée à un projet doit afficher ce lien dans sa carte.

Une interaction liée à un projet doit permettre de remonter vers ce projet.

## Règle 4 — Le budget ne doit pas bloquer la création d'un projet

Le budget prévisionnel et le coût réel sont optionnels.

Un projet sans budget est un projet valide.

## Règle 5 — La clôture préserve l'historique

Marquer un projet comme `completed` ou `cancelled` ne doit rien supprimer.

Toutes les interactions et documents liés restent consultables via le projet et via leurs vues respectives.

## Règle 6 — Les projets actifs doivent être facilement accessibles

Les projets épinglés ou actifs doivent apparaître en tête de liste et, à terme, dans le dashboard.

## Backlog produit recommandé pour la V1

## Story 0 — Créer un projet depuis un besoin

En tant que membre du foyer,
je veux créer un projet avec un titre, un type et un statut,
afin d'avoir un point de coordination central pour un chantier ou un sujet de fond.

### Critères d'acceptation

- le formulaire de création est accessible depuis la page projets
- les champs minimaux sont : titre (obligatoire), type, statut
- les champs optionnels sont : description, dates, budget, zones, groupe
- après création, l'utilisateur est redirigé vers le détail du projet

## Story 1 — Créer une tâche ou une note depuis le projet

En tant que membre du foyer,
je veux créer une tâche ou une note directement depuis la page d'un projet,
afin de ne pas perdre le lien entre l'action et le projet qui la motive.

### Critères d'acceptation

- l'onglet Tâches du projet expose un bouton `Ajouter une tâche`
- l'onglet Notes expose un bouton `Ajouter une note`
- le formulaire s'ouvre avec le projet et les zones pré-liés
- la création ne nécessite pas de quitter la page projet
- après création, l'élément apparaît dans l'onglet correspondant

## Story 2 — Voir la synthèse actionnable d'un projet

En tant que membre du foyer,
je veux voir d'un coup d'œil l'état actuel de mon projet,
afin de savoir quoi faire ensuite sans avoir à fouiller.

### Critères d'acceptation

- la synthèse affiche le nombre de tâches ouvertes et les tâches en retard
- la dernière activité (interaction ou document) est visible
- le budget est affiché si renseigné
- la vue est lisible sans scroll sur mobile

## Story 3 — Lier les contacts et prestataires impliqués

En tant que membre du foyer,
je veux voir dans un projet les contacts ou structures qui y sont impliqués,
afin de ne pas devoir les retrouver à chaque fois dans l'annuaire.

### Critères d'acceptation

- le projet affiche les contacts liés via les interactions du projet
- les structures liées via les interactions sont visibles
- l'affichage est en lecture seule en V1

## Story 4 — Naviguer depuis une tâche ou une activité vers son projet

En tant que membre du foyer,
je veux voir depuis une tâche ou une activité à quel projet elle appartient,
afin de retrouver rapidement le contexte global.

### Critères d'acceptation

- la carte d'une tâche liée à un projet affiche le nom du projet
- la ligne d'une interaction liée à un projet affiche le nom du projet
- un clic permet de naviguer vers le détail du projet

## Story 5 — Clôturer un projet proprement

En tant que membre du foyer,
je veux fermer un projet en le marquant comme terminé,
afin qu'il reste consultable avec son historique complet.

### Critères d'acceptation

- le passage au statut `completed` ne supprime rien
- le projet reste accessible dans la liste avec un filtre dédié ou dans l'historique
- toutes les interactions et documents restent consultables depuis le projet

## Recommandation d'interface

## Structure actuelle du détail projet

La page détail expose déjà les onglets suivants :

```
┌──────────────────────────────────────┐
│  Rénovation salle de bain    [Éditer]│
│  Actif  Rénovation  P2               │
│ ─────────────────────────────────── │
│ [Description] [Tâches] [Notes]       │
│ [Dépenses] [Documents] [Timeline]    │
│ [Métriques]                          │
├──────────────────────────────────────┤
│  Tâches (3)                          │
│  ┌────────────────────────────────┐  │
│  │ Appeler le carreleur           │  │
│  │ Salle de bain · dans 2 jours   │  │
│  └────────────────────────────────┘  │
│  ...                                 │
└──────────────────────────────────────┘
```

## Ce qui doit changer

Chaque onglet qui liste des éléments (Tâches, Notes, Dépenses, Documents) doit exposer un bouton de création rapide.

Le formulaire de création doit recevoir le `projectId` et les zones du projet en paramètre.

## Vue de synthèse recommandée

En V1, la synthèse peut être un bloc en tête de la page détail (au-dessus des onglets) :

```
┌──────────────────────────────────────┐
│  3 tâches ouvertes · 1 en retard     │
│  Budget : 2 400 € / 5 000 €  (48%)   │
│  Dernière activité : il y a 2 jours  │
└──────────────────────────────────────┘
```

## Écrans impactés

- [apps/projects/react/ProjectDetail.tsx](/Users/benjaminvandamme/Developer/house/apps/projects/react/ProjectDetail.tsx) — ajout des boutons de création depuis chaque onglet, bloc de synthèse
- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx) — support du paramètre `projectId`
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py) — transmission du `projectId` depuis le contexte projet
- [apps/tasks/react/TaskCard.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskCard.tsx) — affichage du projet si lié
- [apps/interactions/react/InteractionList.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionList.tsx) — affichage du projet si lié

## Hors scope pour la V1

Pour garder une livraison verticale propre :

- Gantt ou vue calendrier du projet
- assignation de tâches à des membres du foyer depuis le projet
- commentaires ou threads de discussion sur un projet
- templates de projet
- notifications ou rappels associés à un projet
- gestion des droits de visibilité par projet
- vue multi-projets / tableau de bord transversal

## Décisions produit recommandées

## 1. Ne pas dupliquer les données

Les tâches et interactions du projet restent dans leur modèle `Interaction`. Le projet est le contexte, pas le conteneur de données.

## 2. La création depuis le projet passe par l'URL, pas un modal custom

La création d'une tâche ou d'une note depuis un projet suit le même pattern que les parcours 01, 02 et 03 : navigation vers `/app/interactions/new/` avec des paramètres en query string (`type`, `project_id`, `zone_ids`).

Ce pattern est cohérent, testable et évite de dupliquer le formulaire.

## 3. La synthèse est calculée côté frontend en V1

Le bloc de synthèse (nombre de tâches ouvertes, tâches en retard, dernière activité) peut être calculé à partir des données déjà chargées dans les onglets, sans endpoint dédié.

## 4. Les contacts et prestataires sont vus en lecture seule en V1

L'affichage des contacts impliqués dans un projet se fait via les interactions qui ont des contacts liés. Pas de gestion directe des "membres du projet" en V1.

## Définition de done du parcours 4

Le parcours peut être considéré comme livré si, pour un utilisateur réel :

1. il peut créer un projet en moins d'une minute
2. depuis le projet, il peut créer une tâche ou une note avec le lien pré-établi
3. la synthèse lui dit immédiatement ce qu'il reste à faire et l'état du budget si renseigné
4. depuis une tâche, il peut retrouver le projet auquel elle appartient
5. il peut clôturer un projet sans perdre son historique
6. la page projet est utilisable sur mobile

## Check de validation manuelle

Avant de considérer la V1 terminée, vérifier ce scénario complet :

1. créer un projet "Rénovation salle de bain" avec statut actif, type rénovation
2. depuis la page du projet, créer une tâche "Appeler le carreleur" liée à ce projet
3. vérifier que la tâche apparaît dans l'onglet Tâches du projet
4. vérifier que la tâche apparaît dans la liste globale des tâches avec le nom du projet
5. créer un événement "Visite du carreleur" lié au projet
6. vérifier que l'événement apparaît dans l'onglet Timeline du projet
7. ouvrir la synthèse et vérifier qu'elle reflète l'état réel
8. faire avancer la tâche jusqu'à `Fait`
9. marquer le projet comme `completed`
10. vérifier que toutes les interactions restent consultables depuis le projet

Backlog technique associé : `docs/PARCOURS_04_BACKLOG_TECHNIQUE.md`
