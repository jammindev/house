# Parcours 05 — Naviguer par zone ou équipement pour comprendre et agir

Ce document détaille le cinquième parcours métier à travailler dans House.

Il s'appuie sur l'état actuel du projet Django + React hybride, sur le socle posé par les parcours 01 à 04.

## Résumé

Le cinquième usage fondamental du produit est le suivant :

"Je veux comprendre ce qui se passe dans une pièce ou sur un équipement sans avoir à fouiller partout."

Ce parcours est la couture qui donne de la cohérence spatiale à toute la mémoire du foyer.

- Des événements, des tâches, des documents et des projets se rapportent souvent à un lieu précis.
- Un équipement accumule une histoire : installation, entretiens, pannes, garantie.
- Sans une vue centrée sur le lieu ou l'objet, l'utilisateur doit croiser manuellement des informations dispersées.

La zone et l'équipement deviennent les points d'entrée naturels pour explorer et agir dans un contexte spatial.

## Positionnement produit

Les parcours 01 à 04 ont construit la mémoire chronologique du foyer (événements, documents, tâches, projets). Le parcours 05 ouvre la navigation spatiale : on peut maintenant entrer dans le produit par le lieu ou l'objet, pas seulement par la date ou le type d'action.

## Concept interne

### Zone

Le modèle `Zone` existe dans [apps/zones/models.py](/Users/benjaminvandamme/Developer/house/apps/zones/models.py).

Champs clés :
- `name`, `parent` (FK self), `color`, `surface`, `note`
- `full_path` (calculé : "Maison / Rez-de-chaussée / Cuisine")
- `depth` (0 = racine)

Relations inverses exploitables :
- `zone.interactions` — via `InteractionZone` M2M
- `zone.project_zones` — projets qui touchent cette zone
- `zone.equipment` — équipements installés dans cette zone
- `zone.stock_items` — articles de stock dans cette zone
- `zone.children` — sous-zones

### Équipement

Le modèle `Equipment` existe dans [apps/equipment/models.py](/Users/benjaminvandamme/Developer/house/apps/equipment/models.py).

Champs clés :
- `name`, `category`, `zone` (FK nullable)
- `manufacturer`, `model`, `serial_number`
- `purchase_date`, `purchase_price`, `purchase_vendor`
- `warranty_expires_on`, `warranty_provider`, `warranty_notes`
- `maintenance_interval_months`, `last_service_at`, `next_service_due` (calculé)
- `status` : `active`, `maintenance`, `storage`, `retired`, `lost`, `ordered`
- `condition`, `installed_at`, `retired_at`, `notes`, `tags`

Relation vers les interactions via `EquipmentInteraction` (through table).

## Concept visible côté utilisateur

Dans l'interface, le vocabulaire à utiliser est :

- vue principale zones : `Pièces` ou `Espaces`
- vue principale équipements : `Équipements`
- navigation : `Voir tout ce qui concerne cette pièce`, `Historique de cet équipement`
- action principale depuis une zone : `Ajouter une activité ici`, `Voir les tâches ouvertes`
- action principale depuis un équipement : `Signaler un problème`, `Enregistrer un entretien`

## Objectif produit

Permettre à un membre du foyer de :

1. ouvrir une zone et voir immédiatement ce qui s'y passe : équipements, tâches ouvertes, dernières activités, projets en cours
2. ouvrir un équipement et voir son historique complet : entretiens, pannes, garantie
3. créer une activité ou une tâche directement depuis une zone ou un équipement, avec le contexte pré-lié
4. naviguer entre les sous-zones d'un espace hiérarchique
5. savoir depuis un équipement dans quelle pièce il se trouve et y naviguer

## Ce que le projet a déjà aujourd'hui

### Module zones existant

Un module zones complet existe dans [apps/zones/](/Users/benjaminvandamme/Developer/house/apps/zones/).

Pages accessibles via `/app/zones/` :

- liste des zones avec arbre hiérarchique collapsible
- détail d'une zone avec stats (sous-zones, photos), galerie de photos, note, surface

Les composants React existants :

- [apps/zones/react/ZonesNode.tsx](/Users/benjaminvandamme/Developer/house/apps/zones/react/ZonesNode.tsx) — liste arborescente
- [apps/zones/react/ZoneDetailNode.tsx](/Users/benjaminvandamme/Developer/house/apps/zones/react/ZoneDetailNode.tsx) — détail avec galerie
- [apps/zones/react/components/ZoneDetailView.tsx](/Users/benjaminvandamme/Developer/house/apps/zones/react/components/ZoneDetailView.tsx) — infos + stats
- [apps/zones/react/hooks/useZones.ts](/Users/benjaminvandamme/Developer/house/apps/zones/react/hooks/useZones.ts) — hook de données

### Module équipements existant

Un module équipements complet existe dans [apps/equipment/](/Users/benjaminvandamme/Developer/house/apps/equipment/).

Pages accessibles via `/app/equipment/` :

- liste des équipements avec filtres statut/zone/recherche
- création et édition d'un équipement
- détail d'un équipement avec interactions liées

Les composants React existants couvrent déjà les usages CRUD :

- [apps/equipment/react/EquipmentList.tsx](/Users/benjaminvandamme/Developer/house/apps/equipment/react/EquipmentList.tsx)
- [apps/equipment/react/EquipmentDetail.tsx](/Users/benjaminvandamme/Developer/house/apps/equipment/react/EquipmentDetail.tsx)
- [apps/equipment/react/EquipmentForm.tsx](/Users/benjaminvandamme/Developer/house/apps/equipment/react/EquipmentForm.tsx)

### API existante

- zones : `/api/zones/`, `/api/zones/{id}/`, `/api/zones/tree/`, `/api/zones/{id}/children/`, `/api/zones/{id}/photos/`
- équipements : `/api/equipment/equipment/`, `/api/equipment/equipment/{id}/`
- interactions filtrées par zone : `/api/interactions/interactions/?zone=<id>` (à vérifier)
- interactions filtrées par équipement : via `EquipmentInteraction`

## Diagnostic actuel

Le module zones et le module équipements ont tous les deux un socle CRUD solide.

Cependant, les pages actuelles sont des pages de gestion, pas des pages de navigation contextuelle.

Ce qui fonctionne :
- créer, éditer, supprimer une zone ou un équipement
- voir la hiérarchie des zones
- attacher des photos à une zone
- créer une interaction depuis la page équipement avec zone pré-remplie
- filtrer les équipements par zone

Ce qui manque pour rendre le parcours vraiment fort :

- la page détail zone ne montre pas les équipements installés dedans
- la page détail zone ne montre pas les interactions récentes dans cette zone
- la page détail zone ne montre pas les tâches ouvertes ni les projets actifs liés
- la page détail équipement ne propose pas de créer une activité avec l'équipement pré-lié au formulaire standard
- la navigation entre zone parent et zones enfants n'est pas fluide depuis le détail
- il n'y a pas de bouton "Voir tout ce qui concerne cette pièce" dans les vues croisées (tâches, interactions, projets)

## Problème utilisateur précis

Quand l'utilisateur pense "je veux savoir ce qui s'est passé dans la cuisine cette année" ou "je veux voir l'historique de la chaudière", il n'a pas de point d'entrée direct.

Il doit :
- aller dans l'historique des activités et filtrer par zone manuellement
- aller dans la liste des équipements et retrouver la chaudière
- reconstruire mentalement les liens entre zone, équipement, tâches et projets

La zone et l'équipement doivent devenir des points d'entrée navigationnels, pas seulement des attributs de filtrage.

## Utilisateur cible

Pour ce parcours, la cible principale est un membre du foyer qui veut inspecter ou piloter un contexte spatial précis.

Exemples :
- "Qu'est-ce qui a été fait dans la salle de bain depuis que je l'ai rénovée ?"
- "Quelle est la prochaine maintenance sur la chaudière et quand a-t-elle été installée ?"
- "Quels équipements sont dans le garage et lesquels sont sous garantie ?"
- "Y a-t-il des tâches ouvertes concernant le salon ?"

## Scénarios prioritaires

### Scénario A — Explorer une zone

"Je suis sur la page de la cuisine. Je veux voir tout ce qui s'y passe : équipements, tâches ouvertes, dernières activités."

### Scénario B — Explorer un équipement

"J'ouvre la fiche de la chaudière. Je vois sa date d'installation, sa prochaine maintenance, et les trois dernières interventions."

### Scénario C — Créer une activité depuis le contexte zone ou équipement

"Je suis sur la page de la cuisine. Je veux noter qu'une ampoule a grillé. Je crée l'activité sans quitter le contexte de la pièce."

### Scénario D — Naviguer dans la hiérarchie des zones

"Je suis sur la page Rez-de-chaussée. Je vois les sous-zones. Je clique sur Cuisine pour naviguer dedans."

### Scénario E — Voir les tâches ouvertes pour une zone

"Je prépare une visite de contrôle. J'ouvre la zone Chaufferie et je vois immédiatement les 2 tâches ouvertes sur cette zone."

## Parcours cible

### Naviguer dans une zone

1. L'utilisateur ouvre la liste des zones.
2. Il clique sur une zone (ex : "Cuisine").
3. Il voit : sous-zones, équipements présents, tâches ouvertes, activités récentes, projets actifs.
4. Il peut créer une activité ou une tâche directement depuis ce contexte.

### Explorer un équipement

1. L'utilisateur ouvre la liste des équipements ou arrive depuis la zone.
2. Il clique sur un équipement (ex : "Chaudière Viessmann").
3. Il voit : zone, statut, garantie, prochaine maintenance, historique des interventions.
4. Il peut enregistrer une intervention directement depuis cette page.

## Règles produit

### Règle 1 — La zone est un contexte de navigation, pas seulement un tag

La zone ne sert pas qu'à filtrer. Elle est un point d'entrée à part entière.

Une page zone doit montrer tout ce qui touche à cet espace.

### Règle 2 — L'équipement a une identité propre

L'équipement n'est pas juste une interaction. Il a une fiche, une histoire, une localisation, une garantie.

La fiche équipement est le point de vérité sur cet objet.

### Règle 3 — La création depuis le contexte doit être sans friction

Créer une activité depuis une zone ou un équipement ne doit pas nécessiter de naviguer ailleurs.

Le contexte (zone, équipement) doit être transmis automatiquement au formulaire de création.

### Règle 4 — La navigation hiérarchique doit être fluide

Depuis une sous-zone, on doit pouvoir remonter vers la zone parente.

Depuis une zone parente, on doit pouvoir naviguer vers les sous-zones.

### Règle 5 — L'équipement connaît sa zone

Un équipement doit toujours afficher la zone où il se trouve et permettre d'y naviguer.

## Backlog produit recommandé pour la V1

### Story 0 — Explorer une zone en un coup d'œil

En tant que membre du foyer,
je veux ouvrir une zone et voir immédiatement son contenu,
afin de comprendre l'état de cet espace sans fouiller.

#### Critères d'acceptation

- la page détail zone affiche les sous-zones directes
- la page détail zone affiche les équipements installés
- la page détail zone affiche les tâches ouvertes (interactions type=todo liées à cette zone)
- la page détail zone affiche les 5 activités récentes (interactions hors todo)
- les projets actifs touchant cette zone sont visibles

### Story 1 — Agir depuis le contexte zone

En tant que membre du foyer,
je veux créer une activité ou une tâche directement depuis la page d'une zone,
afin de ne pas perdre le contexte spatial.

#### Critères d'acceptation

- un bouton `Ajouter une activité` ouvre le formulaire avec la zone pré-liée
- un bouton `Ajouter une tâche` ouvre le formulaire avec la zone pré-liée et `type=todo`
- la zone n'est pas écrasable depuis le formulaire dans ce contexte

### Story 2 — Explorer l'historique d'un équipement

En tant que membre du foyer,
je veux voir la fiche complète d'un équipement,
afin de connaître son statut, sa garantie et son historique d'interventions.

#### Critères d'acceptation

- la fiche affiche : zone, statut, catégorie, fabricant, modèle, numéro de série
- la garantie est visible avec date d'expiration mise en évidence si proche ou dépassée
- la prochaine maintenance est affichée si un intervalle est défini
- les interactions liées à cet équipement sont listées (via `EquipmentInteraction`)

### Story 3 — Créer une activité depuis un équipement

En tant que membre du foyer,
je veux enregistrer une intervention sur un équipement depuis sa fiche,
afin de maintenir son historique à jour.

#### Critères d'acceptation

- un bouton `Enregistrer une intervention` est accessible depuis la fiche équipement
- le formulaire s'ouvre avec la zone de l'équipement pré-liée
- l'interaction créée est liée à l'équipement via `EquipmentInteraction`
- l'interaction apparaît dans l'historique de l'équipement sans rechargement

### Story 4 — Naviguer entre zones et équipements

En tant que membre du foyer,
je veux naviguer facilement entre une zone et ses sous-zones, et entre un équipement et sa zone,
afin d'explorer le contexte spatial sans perdre le fil.

#### Critères d'acceptation

- la page détail zone affiche un lien vers la zone parente si elle existe
- chaque sous-zone est un lien navigable vers sa propre page détail
- la fiche équipement affiche un lien vers la zone où il se trouve
- la page liste des équipements filtre par zone depuis un clic sur la zone

## Recommandation d'interface

### Structure cible du détail zone

```
┌──────────────────────────────────────┐
│  Cuisine                  [+ Activ.] │
│  Rez-de-chaussée > Cuisine           │
│  24 m²  ·  3 équipements             │
├──────────────────────────────────────┤
│  Sous-zones                          │
│  ┌──────────────┐                    │
│  │ Plan de trav.│                    │
│  └──────────────┘                    │
├──────────────────────────────────────┤
│  Équipements (3)                     │
│  Lave-vaisselle · actif              │
│  Réfrigérateur · actif               │
│  Hotte · maintenance                 │
├──────────────────────────────────────┤
│  Tâches ouvertes (1)                 │
│  Nettoyer le filtre · dans 3 jours   │
├──────────────────────────────────────┤
│  Activité récente                    │
│  Remplacement joint · il y a 2 jours │
│  Inspection annuelle · il y a 3 mois │
└──────────────────────────────────────┘
```

### Structure cible de la fiche équipement

```
┌──────────────────────────────────────┐
│  Chaudière Viessmann     [+ Interv.] │
│  Chauffage > Chaudière  ·  Actif     │
├──────────────────────────────────────┤
│  Garantie : expire 2027-06           │
│  Prochaine maintenance : 2026-09     │
│  Installé le : 2022-06-15            │
├──────────────────────────────────────┤
│  Interventions (4)                   │
│  Entretien annuel · 2025-09          │
│  Remplacement vase expansion · 2024  │
│  ...                                 │
└──────────────────────────────────────┘
```

## Écrans impactés

- [apps/zones/react/ZoneDetailNode.tsx](/Users/benjaminvandamme/Developer/house/apps/zones/react/ZoneDetailNode.tsx) — enrichissement avec équipements, tâches, activités récentes, projets, boutons d'action
- [apps/zones/views_web.py](/Users/benjaminvandamme/Developer/house/apps/zones/views_web.py) — `AppZoneDetailView.get_props()` : stats enrichies
- [apps/equipment/react/EquipmentDetail.tsx](/Users/benjaminvandamme/Developer/house/apps/equipment/react/EquipmentDetail.tsx) — restructuration pour mettre en avant zone, garantie, maintenance, historique
- [apps/equipment/views_web.py](/Users/benjaminvandamme/Developer/house/apps/equipment/views_web.py) — `AppEquipmentDetailView` : transmission du `zoneId` et `equipmentId` pour le formulaire d'interaction
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py) — `AppInteractionNewView` : support du paramètre `equipment_id`

## Hors scope pour la V1

- carte graphique ou plan de l'espace
- gestion des droits de visibilité par zone
- import d'inventaire équipements en masse
- alertes automatiques sur garantie ou maintenance à venir
- historique de déplacement d'un équipement entre zones
- tableau de bord transversal "tous les équipements sous garantie"
- gestion du stock par zone (parcours distinct)

## Décisions produit recommandées

### 1. Enrichir le détail zone sans refondre la gestion

La page détail zone existante est une page de gestion (édition, photos). L'enrichir avec les données contextuelles est une extension, pas une refonte.

Les nouvelles sections (équipements, tâches, activité récente) s'ajoutent en dessous des informations de gestion existantes.

### 2. Le lien équipement → interaction passe par l'URL

Comme pour le projet (parcours 04), la création d'une intervention depuis un équipement suit le même pattern : navigation vers `/app/interactions/new/?equipment_id=<id>&zone_ids=<id>`.

`AppInteractionNewView` est étendu pour détecter `equipment_id`, valider l'appartenance, créer le lien `EquipmentInteraction` après création.

### 3. Les données contextuelles sont calculées côté frontend

Les équipements, tâches et activités de la zone sont chargés en parallèle via les API existantes filtrées par `zone_id`. Pas d'endpoint dédié en V1.

### 4. L'historique équipement reste basé sur `EquipmentInteraction`

Le modèle `EquipmentInteraction` existe et fonctionne. On l'exploite sans le changer.

## Définition de done du parcours 05

Le parcours peut être considéré comme livré si, pour un utilisateur réel :

1. il peut ouvrir une zone et voir ses équipements, tâches ouvertes et activités récentes
2. depuis une zone, il peut créer une activité avec la zone pré-liée
3. il peut ouvrir un équipement et voir son statut, sa garantie et ses interventions passées
4. depuis un équipement, il peut enregistrer une intervention liée à cet équipement
5. il peut naviguer de l'équipement vers sa zone et de la zone vers ses sous-zones
6. la page zone et la page équipement sont utilisables sur mobile

## Check de validation manuelle

Avant de considérer la V1 terminée, vérifier ce scénario complet :

1. ouvrir la zone "Cuisine" — vérifier que les équipements de la cuisine sont visibles
2. vérifier que les tâches ouvertes de la cuisine s'affichent
3. créer une activité "Ampoule grillée" depuis la page zone — vérifier que la zone est pré-liée
4. ouvrir la fiche "Lave-vaisselle" — vérifier zone, statut, garantie
5. enregistrer une intervention "Nettoyage filtre" depuis la fiche — vérifier qu'elle apparaît dans l'historique
6. depuis la fiche équipement, naviguer vers la zone "Cuisine"
7. depuis "Cuisine", naviguer vers "Rez-de-chaussée" (zone parente)

Backlog technique associé : `docs/PARCOURS_05_BACKLOG_TECHNIQUE.md`
