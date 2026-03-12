# Parcours 06 — Recevoir les bons rappels au bon moment pour ne rien rater

Ce document détaille le sixième parcours métier à travailler dans House.

Il s'appuie sur l'état actuel du projet Django + React hybride, sur le socle posé par les parcours 01 à 05.

## Résumé

Le sixième usage fondamental du produit est le suivant :

"Je veux savoir ce qui mérite mon attention dans la maison sans avoir à tout parcourir manuellement."

Les cinq premiers parcours ont construit la mémoire du foyer. Le produit capture, organise et relie les informations. Mais c'est toujours l'utilisateur qui doit aller chercher.

- Les tâches ont une date d'échéance, mais rien ne signale qu'elles sont en retard.
- Les équipements ont une date de garantie et un intervalle de maintenance, mais rien n'avertit quand une action s'impose.
- Le dashboard existe, mais il est neutre : il n'indique pas ce qui est urgent.

Ce parcours transforme le produit d'un système de mémoire passif en un système d'attention active : l'utilisateur arrive dans l'application et voit immédiatement ce qui requiert son attention.

## Positionnement produit

Les parcours 01 à 05 permettent de tout capturer et retrouver. Le parcours 06 ferme la boucle : le produit ne se contente plus de stocker, il signale. L'utilisateur n'a plus besoin de fouiller pour savoir si quelque chose est en attente.

## Concept interne

Les alertes ne sont pas un nouveau modèle de données. Elles sont dérivées des données existantes :

### Tâches en retard

Interactions de type `todo` avec `due_date < aujourd'hui` et `status` différent de `done` ou `cancelled`.

Modèle : `Interaction` — `apps/interactions/models.py`

### Garanties à expiration proche

Équipements dont `warranty_expires_on` est dans les 90 prochains jours.

Modèle : `Equipment` — `apps/equipment/models.py`

Champ : `warranty_expires_on` (DateField, nullable)

### Maintenances planifiées à venir

Équipements dont `next_service_due` est dans les 30 prochains jours.

Modèle : `Equipment` — champ calculé `next_service_due` (propriété depuis `last_service_at` + `maintenance_interval_months`).

### Tâches sans date mais ouvertes depuis longtemps

Interactions de type `todo` sans `due_date`, avec `status` en cours, créées il y a plus de 30 jours.

## Concept visible côté utilisateur

Dans l'interface, le vocabulaire à utiliser est :

- section principale : `À surveiller`, `Attention requise` ou `Rappels`
- entrée de catégorie : `Tâches en retard`, `Garanties bientôt expirées`, `Maintenances à planifier`
- indicateur global : badge numérique dans la navigation principale si des alertes existent
- action depuis une alerte : lien direct vers l'entité concernée (tâche, fiche équipement)

## Objectif produit

Permettre à un membre du foyer de :

1. voir en un coup d'œil ce qui mérite son attention dès l'ouverture du dashboard
2. accéder à une vue synthétique de toutes les alertes actives, organisées par catégorie
3. naviguer en un clic depuis une alerte vers l'entité concernée pour agir
4. marquer une tâche comme faite ou une alerte comme ignorée sans perdre l'historique

## Ce que le projet a déjà aujourd'hui

### Données sources disponibles

- `Interaction` avec `type=todo`, `due_date`, `status` — filtrable via l'API interactions existante
- `Equipment` avec `warranty_expires_on`, `maintenance_interval_months`, `last_service_at`, `next_service_due` (calculé)
- `EquipmentSerializer` expose déjà `next_service_due` comme champ calculé read-only
- Page dashboard existante : [apps/interactions/react/DashboardNode.tsx](/apps/interactions/react/DashboardNode.tsx)
- Section tâches en retard déjà détectée dans [apps/tasks/react/TasksNode.tsx](/apps/tasks/react/TasksNode.tsx) côté frontend

### API existantes exploitables

- `GET /api/interactions/interactions/?type=todo&ordering=due_date` — tâches filtrables
- `GET /api/equipment/equipment/` — liste équipements avec garantie et maintenance

### Ce qui manque pour fermer le parcours

- aucune vue "alertes" centralisée dans le produit
- aucun indicateur visuel global (badge, count) dans la navigation
- le dashboard n'a pas de section dédiée à l'attention requise
- aucun endpoint backend qui agrège les alertes en un seul appel
- les garanties et maintenances ne sont consultables que depuis la fiche équipement individuelle

## Diagnostic actuel

Le produit sait tout ce qui est en retard ou en danger. Mais il ne le dit pas.

Ce qui fonctionne :
- la page tâches détecte les retards côté frontend et les positionne en tête de liste
- la fiche équipement affiche la garantie avec un badge coloré
- les APIs existantes permettent de récupérer les données nécessaires avec les bons filtres

Ce qui manque pour rendre le parcours fort :
- une vue transversale "voici ce qui mérite ton attention" accessible depuis partout
- un signal visible depuis le dashboard sans avoir à naviguer dans chaque section
- un point d'entrée unique pour agir sur tous les sujets urgents

## Problème utilisateur précis

Quand l'utilisateur arrive dans l'application le lundi matin, il ne sait pas s'il a des tâches en retard, si une garantie expire ce mois-ci ou si la chaudière doit passer en révision dans 10 jours. Il doit ouvrir séparément la page tâches, la liste des équipements et croiser mentalement les informations.

Ce parcours transforme ce coût cognitif en une lecture immédiate.

## Utilisateur cible

Pour ce parcours, la cible principale est le membre du foyer responsable de la maintenance et de l'organisation.

Exemples :
- "Je veux savoir avant de partir en vacances si des tâches sont en retard."
- "J'ai oublié que la garantie du lave-vaisselle expire dans 6 semaines — j'aurais voulu le savoir."
- "Je n'arrive pas à suivre toutes les maintenances préventives sans que ça me saute aux yeux."
- "J'ai 12 tâches dans le backlog, mais laquelle est vraiment urgente ?"

## Scénarios prioritaires

### Scénario A — Voir les alertes au premier coup d'œil

"J'ouvre le dashboard. Je vois une section 'À surveiller' avec 3 éléments. Je comprends immédiatement que j'ai 2 tâches en retard et 1 garantie qui expire bientôt."

### Scénario B — Accéder à la synthèse complète des alertes

"Je clique sur 'Voir tout' dans la section alertes. J'arrive sur une page dédiée qui liste toutes les tâches en retard, les garanties bientôt expirées et les maintenances à planifier, par catégorie."

### Scénario C — Agir depuis une alerte

"Je vois dans les alertes que la tâche 'Appeler le plombier' est en retard de 5 jours. Je clique dessus. Je la marque comme faite. Elle disparaît de la liste."

### Scénario D — Aller directement à la fiche équipement depuis une alerte garantie

"Je vois que la garantie du lave-vaisselle expire dans 3 semaines. Je clique sur l'alerte. J'arrive sur la fiche équipement pour retrouver le numéro de série et le contact du SAV."

## Parcours cible

### Voir ses alertes du jour

1. L'utilisateur ouvre le dashboard.
2. Il voit en haut une section "À surveiller" avec un résumé des alertes actives.
3. Il clique sur une alerte pour naviguer vers l'entité concernée.
4. Il peut agir depuis cette page (marquer comme fait, programmer une maintenance, etc.).

### Consulter toutes les alertes

1. L'utilisateur clique sur "Voir tout" depuis la section dashboard, ou navigue vers la page Alertes.
2. Il voit la liste complète, organisée par catégorie : Tâches en retard / Garanties / Maintenances.
3. Il filtre ou trie selon ses besoins.
4. Il clique sur chaque alerte pour naviguer vers l'entité.

## Règles produit

### Règle 1 — Les alertes sont dérivées, pas saisies

Il n'y a pas de "gestion des alertes" dans l'interface. Les alertes sont calculées automatiquement depuis les données existantes. L'utilisateur n'a rien à configurer.

### Règle 2 — Chaque alerte mène à une action

Une alerte sans lien d'action est une notification vide. Chaque alerte doit pointer vers l'entité où l'utilisateur peut agir (tâche, fiche équipement).

### Règle 3 — Le signal doit être visible sans être intrusif

Le badge dans la navigation signale qu'il y a quelque chose, mais ne bloque pas l'utilisation. La section dashboard est compacte et peut être ignorée.

### Règle 4 — Les alertes résolues disparaissent automatiquement

Quand une tâche est marquée comme faite, elle quitte la liste des alertes. Quand une garantie n'est plus dans la fenêtre d'alerte, elle disparaît. Il n'y a pas de gestion manuelle de l'état des alertes.

### Règle 5 — La sévérité est lisible d'un coup d'œil

Les alertes critiques (tâche en retard depuis plusieurs jours, garantie expirée) sont distinguées visuellement des alertes préventives (garantie dans 90 jours, maintenance dans 30 jours).

## Backlog produit recommandé pour la V1

### Story 0 — Section alertes sur le dashboard

En tant que membre du foyer,
je veux voir sur le dashboard un résumé des sujets urgents,
afin de savoir immédiatement si quelque chose requiert mon attention.

#### Critères d'acceptation

- la section "À surveiller" apparaît sur le dashboard si au moins une alerte est active
- elle affiche au maximum 5 éléments (les plus urgents)
- les tâches en retard sont listées avec leur titre et leur retard en jours
- les garanties qui expirent dans les 90 jours sont listées avec le nom de l'équipement et la date
- les maintenances dues dans les 30 jours sont listées avec le nom de l'équipement
- un lien "Voir tout" mène à la page dédiée

### Story 1 — Page Alertes dédiée

En tant que membre du foyer,
je veux accéder à une vue complète et organisée de toutes les alertes actives,
afin de pouvoir prioriser mes actions sans fouiller dans chaque section.

#### Critères d'acceptation

- la page est accessible depuis le dashboard et depuis la navigation principale
- les alertes sont organisées en 3 sections : Tâches en retard / Garanties à surveiller / Maintenances à planifier
- chaque alerte affiche le titre, la date de référence et un indicateur de sévérité
- un clic sur une alerte navigue vers l'entité concernée
- la page est utilisable sur mobile

### Story 2 — Badge de navigation

En tant que membre du foyer,
je veux voir un indicateur visuel dans la navigation quand des alertes sont actives,
afin de ne jamais oublier qu'il y a quelque chose à traiter.

#### Critères d'acceptation

- un badge numérique apparaît dans la navigation principale si des alertes sont actives
- le badge compte le total des alertes actives (toutes catégories confondues)
- le badge disparaît quand toutes les alertes sont résolues ou hors fenêtre
- le badge ne perturbe pas la navigation si aucune alerte n'est active

### Story 3 — Endpoint backend de synthèse des alertes

En tant que système,
je veux un endpoint dédié qui agrège toutes les alertes actives du household,
afin d'éviter de multiplier les appels API côté frontend.

#### Critères d'acceptation

- `GET /api/alerts/summary/` retourne les alertes agrégées en une seule requête
- la réponse contient trois sections : `overdue_tasks`, `expiring_warranties`, `due_maintenances`
- chaque item contient : `id`, `title`, `entity_type`, `entity_url`, `severity` (`critical` ou `warning`), `reference_date`
- l'endpoint respecte le scope household de l'utilisateur connecté
- les fenêtres de temps sont : retard immédiat pour les tâches, 90 jours pour les garanties, 30 jours pour les maintenances

## Recommandation d'interface

### Section dashboard (vue compacte)

```
┌──────────────────────────────────────┐
│  À surveiller (5)        [Voir tout] │
├──────────────────────────────────────┤
│  ⚠ Appeler le plombier · 5j de retard│
│  ⚠ Vérifier toiture · 2j de retard  │
│  ◉ Garantie lave-vaisselle · 3 sem.  │
│  ◉ Révision chaudière · 12 jours    │
│  ◎ Garantie TV salon · 87 jours      │
└──────────────────────────────────────┘
```

### Page Alertes (vue complète)

```
┌──────────────────────────────────────┐
│  Alertes                             │
│                                      │
│  Tâches en retard (2)                │
│  ────────────────────────────────    │
│  Appeler le plombier · 5j · ⚠ retard │
│  Vérifier toiture · 2j · ⚠ retard   │
│                                      │
│  Garanties à surveiller (2)          │
│  ────────────────────────────────    │
│  Lave-vaisselle · expire 01/04/2026  │
│  TV salon · expire 07/06/2026        │
│                                      │
│  Maintenances à planifier (1)        │
│  ────────────────────────────────    │
│  Chaudière · révision prévue 23/03   │
└──────────────────────────────────────┘
```

## Écrans impactés

- [apps/interactions/react/DashboardNode.tsx](/apps/interactions/react/DashboardNode.tsx) — ajout section "À surveiller"
- [apps/interactions/views_web.py](/apps/interactions/views_web.py) — `AppDashboardView.get_props()` : ajout de l'URL de synthèse et du compte d'alertes
- Nouvelle mini-SPA React pour la page Alertes : `apps/alerts/react/AlertsNode.tsx`
- Navigation principale (template Django) — intégration du badge d'alertes
- Nouvel endpoint API : `GET /api/alerts/summary/` — à créer dans une nouvelle app `alerts` ou dans `apps/core/`

## Hors scope pour la V1

- emails ou push notifications de rappel
- configuration des fenêtres d'alerte par l'utilisateur (délai personnalisable)
- alertes sur les projets sans activité récente
- alertes sur les documents sans activité ou non reliés
- historique des alertes passées
- snooze ou report d'une alerte
- alertes sur les dépenses (budget dépassé sur un projet)

## Décisions produit recommandées

### 1. Backend léger : un endpoint agrégateur

Pour la V1, un endpoint `GET /api/alerts/summary/` calcule les alertes à la demande. Pas de table `alerts` en base, pas de scheduler. Les alertes sont derivées du modèle existant à chaque requête. La perf est suffisante pour les volumes d'un household.

Si les volumes augmentent ou si des notifications asynchrones sont nécessaires en V2, on introduira une table `Alert` avec statut et une tâche Celery.

### 2. Le dashboard charge les alertes en parallèle

La section "À surveiller" est chargée via un appel API séparé au montage du dashboard, en parallèle des autres sections existantes. Pas de props Django pour ce contenu dynamique — les alertes varient sans rechargement de page.

### 3. Le badge de navigation est alimenté par le même endpoint

Le count total (`total`) est extrait de la réponse `GET /api/alerts/summary/` et stocké dans un contexte React global (ou un simple fetch au montage de la navigation). Pas de websocket ou de polling en V1 — un appel au chargement de chaque page suffit.

### 4. Les fenêtres d'alerte sont fixes en V1

- tâches en retard : `due_date < aujourd'hui` (aucune tolérance)
- garanties : `warranty_expires_on` dans les 90 prochains jours
- maintenances : `next_service_due` dans les 30 prochains jours

Ces valeurs sont configurables côté serveur si nécessaire, sans interface utilisateur en V1.

## Définition de done du parcours 06

Le parcours peut être considéré comme livré si, pour un utilisateur réel :

1. il ouvre le dashboard et voit immédiatement ses tâches en retard et ses alertes équipements
2. il peut accéder à la page Alertes et voir toutes les alertes actives organisées par catégorie
3. il peut cliquer sur une alerte et naviguer vers l'entité concernée en un clic
4. le badge dans la navigation reflète le nombre d'alertes actives
5. les alertes résolues (tâches marquées faites, équipements dont la garantie ne tombe plus dans la fenêtre) disparaissent sans action manuelle
6. la section dashboard et la page alertes sont utilisables sur mobile

## Check de validation manuelle

Avant de considérer la V1 terminée, vérifier ce scénario complet :

1. créer une tâche avec une date d'échéance passée — vérifier qu'elle apparaît dans la section "À surveiller" du dashboard
2. naviguer vers la page Alertes — vérifier que la tâche est dans la section "Tâches en retard"
3. marquer la tâche comme faite — vérifier qu'elle disparaît des alertes sans rechargement
4. vérifier qu'un équipement dont `warranty_expires_on` est dans les 90 jours apparaît dans les alertes garanties
5. vérifier que le badge de navigation reflète le bon count total
6. vérifier que la page Alertes est lisible sur mobile

Backlog technique associé : `docs/PARCOURS_06_BACKLOG_TECHNIQUE.md`
