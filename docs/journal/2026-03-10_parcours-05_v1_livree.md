# 2026-03-10 — Parcours 05 V1 livrée

## Contexte

Implémentation complète du parcours 05 — Naviguer par zone ou équipement pour comprendre et agir.

Objectif : transformer les pages zones et équipements de pages de gestion passives en pages de navigation contextuelle actionnables.

## Ce qui a été livré

### Préalable — Filtres API

Vérification et complétion des filtres API nécessaires aux sections contextuelles.

- `GET /api/interactions/interactions/?zone=<id>` ✅ déjà en place (filtre custom dans `get_queryset`)
- `GET /api/equipment/equipment/?zone=<id>` ✅ déjà en place (via `filterset_fields`)
- `GET /api/projects/projects/?zone=<id>` ❌ absent — ajouté dans `ProjectViewSet.get_queryset()`
- `GET /api/projects/projects/?status=<value>` ajouté en même temps

### Lot 0 — Détail zone contextuel

`ZoneDetailNode.tsx` transformé en tableau de bord spatial.

- **Zone parente cliquable** dans le header si `parentId` est défini
- **Boutons d'action** `Ajouter une tâche` et `Ajouter une activité` avec `zone_ids=<id>` pré-rempli dans l'URL
- **Section Sous-zones** : liste des enfants directs via `GET /api/zones/{id}/children/`, chacun cliquable
- **Section Équipements** : liste filtrée par zone avec nom et catégorie, cliquables vers la fiche
- **Section Tâches ouvertes** : tâches todo hors `done`/`archived`, avec date relative
- **Section Activité récente** : 5 derniers événements (hors todo), avec date relative
- **Section Projets actifs** : projets liés à la zone avec statut `active`, cliquables vers le détail projet
- Sections masquées automatiquement si vides (V1)
- Chargement en parallèle via `Promise.allSettled` — résilient aux erreurs partielles

`AppZoneDetailView.get_props()` étendu avec `createActivityUrl` et `createTaskUrl`.

### Lot 1 — Équipement contextuel

`EquipmentDetail.tsx` — header restructuré.

- **Zone cliquable** vers `/app/zones/<zoneId>/` affiché sous le nom de l'équipement
- **Badge garantie** tricoloré : `Garantie active` (neutre) / `Garantie bientôt expirée` (ambre, < 6 mois) / `Garantie expirée` (destructive)
- **Date prochaine maintenance** affichée sous le header si `next_service_due` est renseigné
- **Bouton `Enregistrer une intervention`** : navigue vers `/app/interactions/new/?equipment_id=<id>&zone_ids=<zoneId>` — masqué si statut `retired` ou `lost`

`AppInteractionNewView.get_props()` étendu avec `equipment_id` :
- Validation que l'équipement appartient au household (isolation silencieuse si accès refusé)
- `initialEquipmentId` et `initialEquipmentName` retournés dans les props
- Zone de l'équipement utilisée comme `initialZoneIds` si non déjà définie
- Redirection post-création vers `/app/equipment/<id>/`

`InteractionCreateForm.tsx` :
- Props `initialEquipmentId` et `initialEquipmentName` ajoutées
- Bandeau de contexte équipement (identique aux bandeaux projet/document)
- Appel `linkEquipmentInteraction` post-création si `initialEquipmentId` est présent

Support de `?zone_ids=<id>` dans `AppInteractionNewView` :
- Parsing du query param pour pré-remplir `initialZoneIds` depuis le contexte zone (sans passer par source_interaction ou source_project)

### Lot 2 — Tests

Cinq nouveaux tests ajoutés.

`test_web_interactions.py` :
- `test_interaction_new_page_with_equipment_id` : vérifie `initialEquipmentId`, `initialEquipmentName`, `initialZoneIds` (zone de l'équipement), `redirectAfterSuccessUrl`
- `test_interaction_new_page_ignores_equipment_from_other_household` : isolation household silencieuse
- `test_interaction_new_page_with_zone_ids_param` : vérifie que `?zone_ids=<id>` pré-remplit `initialZoneIds`

`test_api_projects.py` :
- `test_list_projects_filtered_by_zone` : filtre `?zone=<id>` retourne uniquement les projets liés à cette zone
- `test_list_projects_filtered_by_status` : filtre `?status=<value>` ne retourne que les projets du bon statut

## Décisions techniques prises

- les données contextuelles du détail zone sont chargées côté frontend via les API existantes — pas d'endpoint dédié, cohérent avec la stratégie des parcours précédents
- chargement parallèle avec `Promise.allSettled` : une section en erreur n'empêche pas les autres de s'afficher
- le badge garantie est calculé côté frontend depuis `warranty_expires_on` — pas de champ calculé côté Django
- le bouton intervention est masqué pour `retired`/`lost` — décision produit V1
- `zone_ids` pris en compte après `source_interaction` et `source_project` : ces sources ont priorité sur le simple param URL
- le lien `EquipmentInteraction` est créé dans un second appel API post-création, cohérent avec `InteractionDocument` (parcours 02)
- le filtre zone sur projects passe par `project_zones__zone_id` avec `.distinct()` pour éviter les doublons

## Définition de done validée

1. ✅ depuis la page détail d'une zone, les équipements, tâches ouvertes et activités récentes sont visibles
2. ✅ depuis la page détail d'une zone, une activité peut être créée avec la zone pré-liée
3. ✅ depuis la page détail d'un équipement, une intervention peut être enregistrée avec le lien `EquipmentInteraction` créé
4. ✅ le badge garantie s'affiche correctement sur la fiche équipement
5. ✅ la navigation zone ↔ sous-zones et équipement ↔ zone fonctionne
6. ✅ les tests couvrent `AppInteractionNewView` avec `equipment_id`
7. ✅ le filtre `?zone=<id>` sur les projets est couvert par un test

## Références

- [docs/PARCOURS_05_NAVIGUER_PAR_ZONE_OU_EQUIPEMENT.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_05_NAVIGUER_PAR_ZONE_OU_EQUIPEMENT.md)
- [docs/PARCOURS_05_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_05_BACKLOG_TECHNIQUE.md)
