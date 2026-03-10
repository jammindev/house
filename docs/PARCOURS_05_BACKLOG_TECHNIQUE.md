# Parcours 05 — Backlog technique V1

Ce document traduit la décision produit du parcours 05 en backlog technique concret pour le repo actuel.

Flow cible :

1. ouvrir une zone et voir équipements, tâches ouvertes, activités récentes, projets
2. créer une activité ou une tâche depuis le contexte zone avec la zone pré-liée
3. ouvrir un équipement et voir statut, garantie, prochaine maintenance, historique
4. créer une intervention depuis l'équipement avec lien `EquipmentInteraction`
5. naviguer zone ↔ sous-zones et équipement ↔ zone

## Objectif d'implémentation

Transformer les pages zones et équipements de pages de gestion en pages de navigation contextuelle.

Le modèle de données est complet : `Zone`, `Equipment`, `EquipmentInteraction`, `InteractionZone`, `ProjectZone` sont tous en place. L'objectif est uniquement d'ouvrir les points de lecture et d'action dans l'interface.

Les surfaces concernées sont :

- la page détail zone (sections équipements, tâches, activités, projets + boutons d'action)
- la page détail équipement (restructuration header : zone, garantie, maintenance)
- `AppInteractionNewView` (support `equipment_id`)
- `AppZoneDetailView` (props enrichies pour les nouvelles sections)

## État de réalisation au 2026-03-10

### Déjà en place et réutilisable

- `Zone` avec full_path, depth, parent/children, color, surface dans [apps/zones/models.py](/Users/benjaminvandamme/Developer/house/apps/zones/models.py)
- `ZoneDocument` pour les photos
- `/app/zones/` liste arborescente collapsible — [apps/zones/react/ZonesNode.tsx](/Users/benjaminvandamme/Developer/house/apps/zones/react/ZonesNode.tsx)
- `/app/zones/{id}/` détail avec stats, galerie photos — [apps/zones/react/ZoneDetailNode.tsx](/Users/benjaminvandamme/Developer/house/apps/zones/react/ZoneDetailNode.tsx)
- `Equipment` avec tous les champs utiles (zone, garantie, maintenance) dans [apps/equipment/models.py](/Users/benjaminvandamme/Developer/house/apps/equipment/models.py)
- `EquipmentInteraction` through table pour lier interactions à un équipement
- CRUD complet `/app/equipment/` — liste, création, détail, édition
- `EquipmentDetail.tsx` affiche déjà les interactions liées via `EquipmentInteraction`
- `AppInteractionNewView` enrichi pour `project_id` et `source_interaction_id` (parcours 03 et 04)
- endpoint `/api/interactions/interactions/?zone=<id>` — à vérifier qu'il existe dans le filtre

### À construire

- sections contextuelles dans `ZoneDetailNode` : équipements, tâches ouvertes, activités récentes, projets actifs
- boutons `Ajouter une activité` et `Ajouter une tâche` dans le détail zone
- enrichissement du header `EquipmentDetail` : lien vers la zone, badge garantie, date prochaine maintenance
- bouton `Enregistrer une intervention` dans `EquipmentDetail` qui ouvre le formulaire avec équipement pré-lié
- support de `equipment_id` dans `AppInteractionNewView` (validation + création `EquipmentInteraction` post-création)
- navigation parent dans le détail zone (breadcrumb cliquable)
- filtre `?zone=<id>` dans l'API interactions (vérification + exposition si absent)

## Principe d'exécution

Le backlog est organisé en lots techniques verticaux.

Chaque lot produit un incrément testable.

## Décisions de cadrage MVP réalisable

- le modèle de données est suffisant, pas de migration de schema
- la création depuis une zone suit le même pattern que les parcours 03 et 04 : navigation vers `/app/interactions/new/` avec `zone_ids=<id>` en query string
- la création depuis un équipement : navigation vers `/app/interactions/new/?equipment_id=<id>&zone_ids=<zone_id>` — `AppInteractionNewView` détecte `equipment_id`, valide, retourne `initialEquipmentId` + `initialEquipmentName` ; la création du lien `EquipmentInteraction` se fait dans une action API dédiée après création de l'interaction
- les données contextuelles du détail zone sont chargées côté frontend via les API existantes (pas d'endpoint dédié)
- le filtre `?zone=<id>` sur `/api/interactions/` doit être vérifié et exposé si absent
- l'affichage des projets dans le détail zone se fait via `/api/projects/projects/?zone=<id>` — à vérifier que ce filtre existe
- la restructuration de `EquipmentDetail` ne casse pas les fonctionnalités existantes

## Lot 0 — Détail zone contextuel

### But

Transformer la page détail zone en tableau de bord spatial : équipements, tâches ouvertes, activités récentes, projets actifs.

### Fichiers principaux

- [apps/zones/react/ZoneDetailNode.tsx](/Users/benjaminvandamme/Developer/house/apps/zones/react/ZoneDetailNode.tsx)
- [apps/zones/react/components/ZoneDetailView.tsx](/Users/benjaminvandamme/Developer/house/apps/zones/react/components/ZoneDetailView.tsx)
- [apps/zones/views_web.py](/Users/benjaminvandamme/Developer/house/apps/zones/views_web.py)

### Tâches

1. Dans `AppZoneDetailView.get_props()`, ajouter : `createActivityUrl` et `createTaskUrl` construits avec `zone_ids=<zoneId>`.
2. Dans `ZoneDetailNode.tsx` ou `ZoneDetailView.tsx`, ajouter les sections suivantes chargées via fetch au montage :
   - **Sous-zones** : `GET /api/zones/{id}/children/` — liste des enfants directs avec lien vers leur détail
   - **Équipements** : `GET /api/equipment/equipment/?zone=<id>` — liste avec nom, statut, catégorie
   - **Tâches ouvertes** : `GET /api/interactions/interactions/?zone=<id>&type=todo&status__in=backlog,pending,in_progress` — avec date et lien vers la liste tâches filtrée
   - **Activité récente** : `GET /api/interactions/interactions/?zone=<id>&ordering=-occurred_at&limit=5` (hors todo) — sujet, type, date
   - **Projets actifs** : `GET /api/projects/projects/?zone=<id>&status=active` — titre, type, lien vers le projet
3. Ajouter des boutons `Ajouter une activité` → `createActivityUrl` et `Ajouter une tâche` → `createTaskUrl`.
4. Ajouter le lien vers la zone parente dans le header si `parentId` est défini.

### Vérification des filtres API

Avant l'implémentation frontend, vérifier :

- `GET /api/interactions/interactions/?zone=<id>` fonctionne — chercher dans `apps/interactions/views.py` le filtre `zone`
- `GET /api/equipment/equipment/?zone=<id>` fonctionne — chercher dans `apps/equipment/views.py` le filtre `zone`
- `GET /api/projects/projects/?zone=<id>` fonctionne — chercher dans `apps/projects/views.py` le filtre `zone`

Si un filtre est absent, l'ajouter dans le `ViewSet` correspondant.

### Critères de validation

- depuis la page d'une zone, les équipements installés sont visibles
- les tâches ouvertes liées à cette zone sont visibles avec leur date
- les 5 dernières activités (hors todo) s'affichent
- les boutons Ajouter ouvrent le formulaire avec la zone pré-liée
- la zone parente est un lien cliquable dans le header

## Lot 1 — Équipement contextuel

### But

Enrichir la page détail équipement avec zone, garantie, prochaine maintenance, et un bouton d'enregistrement d'intervention.

### Fichiers principaux

- [apps/equipment/react/EquipmentDetail.tsx](/Users/benjaminvandamme/Developer/house/apps/equipment/react/EquipmentDetail.tsx)
- [apps/equipment/views_web.py](/Users/benjaminvandamme/Developer/house/apps/equipment/views_web.py)
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)

### Tâches

1. Dans `EquipmentDetail.tsx`, restructurer le header pour afficher en priorité :
   - zone (nom + lien cliquable vers `/app/zones/<zoneId>/`)
   - statut avec badge coloré
   - badge garantie : "Garantie jusqu'au <date>" avec couleur d'alerte si < 6 mois ou dépassée
   - date prochaine maintenance si `next_service_due` est renseigné
2. Ajouter un bouton `Enregistrer une intervention` qui navigue vers `/app/interactions/new/?equipment_id=<id>&zone_ids=<zoneId>`.
3. Dans `AppInteractionNewView.get_props()` :
   - détecter le paramètre `equipment_id`
   - valider que l'équipement appartient au household de l'utilisateur
   - retourner `initialEquipmentId` et `initialEquipmentName`
   - utiliser la zone de l'équipement comme `initialZoneIds` si pas de zone déjà définie
   - définir `redirectAfterSuccessUrl` vers `/app/equipment/<id>/`
4. Dans `InteractionCreateForm.tsx` :
   - accepter `initialEquipmentId` et `initialEquipmentName` comme props
   - afficher un bandeau de contexte équipement (style identique aux bandeaux projet/interaction existants)
   - inclure `equipment_id` dans le payload — mais l'association `EquipmentInteraction` ne peut pas se faire dans `createInteraction` directement
5. Créer le lien `EquipmentInteraction` : après création de l'interaction, appeler `POST /api/equipment/equipment-interactions/` avec `{ equipment: equipmentId, interaction: createdId }`.
   - vérifier que cet endpoint existe dans `apps/equipment/views.py`
   - si l'endpoint n'existe pas, l'ajouter

### Notes techniques

- `EquipmentSerializer` expose `next_service_due` comme champ calculé read-only — réutilisable directement
- `warranty_expires_on` est une date — calcul côté frontend pour déterminer le badge d'alerte
- le lien `EquipmentInteraction` doit être créé dans un second appel API après création de l'interaction, similaire à `InteractionDocument` dans le parcours 02
- si l'utilisateur arrive sans `equipment_id` (formulaire général), aucun changement de comportement

### Critères de validation

- depuis la fiche équipement, la zone est visible et cliquable
- le badge garantie s'affiche avec la bonne couleur selon la date
- la prochaine maintenance s'affiche si l'intervalle est défini
- un clic sur `Enregistrer une intervention` ouvre le formulaire avec le contexte pré-lié
- l'intervention créée apparaît dans l'historique de l'équipement

## Lot 2 — Tests et validation

### But

Sécuriser les nouveaux flux sans multiplier les tests inutiles.

### Fichiers principaux

- [apps/interactions/tests/test_web_interactions.py](/Users/benjaminvandamme/Developer/house/apps/interactions/tests/test_web_interactions.py)
- [apps/zones/tests/](/Users/benjaminvandamme/Developer/house/apps/zones/tests/) si existant
- [apps/equipment/tests/](/Users/benjaminvandamme/Developer/house/apps/equipment/tests/) si existant

### Tâches

1. Test web : `AppInteractionNewView` avec `equipment_id` — vérifier `initialEquipmentId`, `initialEquipmentName`, `initialZoneIds` (depuis la zone de l'équipement), `redirectAfterSuccessUrl`.
2. Test web : `AppInteractionNewView` avec `equipment_id` d'un autre household — vérifier que les props sont nulles (pas de 404, isolation silencieuse).
3. Test API : `POST /api/equipment/equipment-interactions/` — vérifier que le lien est créé correctement.
4. Vérifier les filtres API : `GET /api/interactions/interactions/?zone=<id>` et `GET /api/equipment/equipment/?zone=<id>` retournent les bons résultats.

### Validation manuelle minimale

1. ouvrir une zone avec des équipements — vérifier qu'ils s'affichent
2. créer une activité depuis la zone — vérifier la zone pré-liée dans le formulaire
3. vérifier que l'activité apparaît dans la section "Activité récente" de la zone
4. ouvrir une fiche équipement — vérifier zone, garantie, prochaine maintenance
5. enregistrer une intervention — vérifier l'historique mis à jour
6. naviguer de l'équipement vers sa zone

## Ordre recommandé d'implémentation

1. Vérification des filtres API (préalable aux deux lots)
2. Lot 0 — Détail zone contextuel (valeur immédiate, impact le plus visible)
3. Lot 1 — Équipement contextuel (complète le parcours)
4. Lot 2 — Tests et validation

## Découpage en sessions de travail

### Session 1

- Vérification et ajout des filtres API manquants (`zone` sur interactions, equipment, projects)
- Lot 0 : sections contextuelles dans le détail zone (frontend uniquement si les filtres existent)

### Session 2

- Lot 1 : équipement contextuel — header enrichi + bouton intervention
- Backend : support `equipment_id` dans `AppInteractionNewView`
- Frontend : bandeau équipement dans `InteractionCreateForm`

### Session 3

- Lot 2 : tests
- Corrections éventuelles post-validation manuelle

## Points de vigilance

- vérifier que `GET /api/interactions/interactions/?zone=<id>` filtre bien par zone (et pas seulement par household) avant de l'utiliser dans le frontend
- vérifier que le filtre `?zone=<id>` sur `/api/equipment/equipment/` filtre sur `zone__id` et non sur `zone__name`
- vérifier que `GET /api/projects/projects/?zone=<id>` existe — il peut ne pas être implémenté si les projets sont filtrés différemment
- ne pas afficher de sections vides sans message explicatif — préférer masquer la section si `count === 0` en V1
- le bouton `Enregistrer une intervention` dans `EquipmentDetail` ne doit pas être visible si l'équipement est `retired` ou `lost` — décision à prendre en V1
- ne pas envoyer `equipment_id` comme champ dans le payload d'interaction — l'association se fait via `EquipmentInteraction`, pas via un champ direct sur `Interaction`
- garder le vocabulaire cohérent : `activité` pour les interactions générales, `intervention` pour le contexte équipement (dans les libellés UI seulement)

## Définition de done technique

La V1 peut être considérée terminée si :

1. depuis la page détail d'une zone, les équipements, tâches ouvertes et activités récentes sont visibles
2. depuis la page détail d'une zone, une activité peut être créée en 2 clics avec la zone pré-liée
3. depuis la page détail d'un équipement, une intervention peut être enregistrée avec le lien `EquipmentInteraction` créé
4. le badge garantie s'affiche correctement sur la fiche équipement
5. la navigation zone ↔ sous-zones et équipement ↔ zone fonctionne
6. les tests couvrent `AppInteractionNewView` avec `equipment_id`
7. les filtres API `?zone=<id>` sont couverts par des tests ou vérifiés manuellement
