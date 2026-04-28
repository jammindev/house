# Module — electricity

> Audit : 2026-04-28. Rôle : modéliser le tableau électrique du foyer (tableaux, protections, circuits, points d'usage) et son historique.

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet dans `ui/src/features/electricity/`
- **Locales (en/fr/de/es)** : ok
- **Tests** : oui — 3 fichiers (`test_models.py`, `test_serializers.py`, `test_views.py`) + `factories.py`
- **Migrations** : 9 total

## Modèles & API

- Modèles principaux : `ElectricityBoard`, `ProtectiveDevice` (breaker / RCD / combined / main), `ElectricCircuit`, `UsagePoint`, `CircuitUsagePointLink`, `MaintenanceEvent`, `PlanChangeLog`
- `ElectricityBoard.zone` et `UsagePoint.zone` sont des FK non-nullables vers `zones.Zone` — rattacher à la zone racine du household si pas de zone spécifique (règle P3 : 1 zone racine par household) — *source : `apps/electricity/models.py:91-95`, `:344-349`*
- Endpoints exposés : `/api/electricity/boards/`, `/protective-devices/`, `/circuits/`, `/usage-points/` (+ `bulk-create/`), `/links/` (+ `deactivate/`), `/maintenance-events/`, `/change-logs/` (read-only)
- Permissions : `IsAuthenticated, IsElectricityOwnerWriteMemberRead` (custom — membres lisent, owners écrivent — *source : `apps/electricity/permissions.py`*)

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

- [ ] Ajouter un champ `parent` (différentiel) dans le formulaire breaker pour relier visuellement la hiérarchie RCD → breaker — *source : inspection code*
- [ ] Pas de connexion claire entre `UsagePoint` et `ElectricCircuit` dans les formulaires : ajouter le lien direct depuis le form `UsagePoint` ou permettre de créer un PU depuis le form circuit — *source : inspection code*
- [ ] À la création d'un breaker ou combined, proposer/forcer la création du circuit associé — *source : inspection code*
- [ ] Revoir le naming et l'étiquetage des `UsagePoint` (label/nom peu lisibles) — *source : inspection code*

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Représentation graphique du tableau (vue "comme si je le regardais" : disjoncteurs/différentiels positionnés) reprenant le style de l'app — *source : inspection code*
- [ ] Section "fils et couleurs" avec recommandations en amont — *source : inspection code*
- [ ] Calculateur de conformité circuit / puissance (norme NF C 15-100) — *source : inspection code*
- [ ] Permettre de "brancher" des équipements et lier le modèle `Equipment` au `ProtectiveDevice` — *source : inspection code*
- [ ] Concept de "boîte de dérivation" en `UsagePoint` à clarifier/modéliser — *source : inspection code*
- [ ] Champ `marque` (potentiellement relié au module equipment) — *source : inspection code*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Si pas de tableau dans le foyer, masquer le champ "tableau parent" et statuer côté back/front sur la convention nul vs absent — *source : inspection code*
- [ ] Déplacer `HouseholdScopedModelSerializer` de `apps/electricity/serializers.py` vers `apps/core/serializers.py` (importé par toutes les apps) — voir issue #43 — *source : `apps/electricity/serializers.py`*
- [ ] La validation cross-table `phase` vs `board.supply_type` est faite en service layer uniquement, pas en DB — *source : `apps/electricity/models.py:163-169` et `:194-196`*

## Notes / décisions produit

- Permissions plus strictes que les autres modules : seul l'owner du household peut écrire (`IsElectricityOwnerWriteMemberRead`) — *source : `apps/electricity/permissions.py:9-32`*.
- Modèle riche en contraintes DB (CheckConstraints sur `position_end`, breaker sans champs RCD, RCD sans curve_type, pole_count valide…) — toucher avec précaution.
- `PlanChangeLog` est un journal d'audit dédié au domaine électrique (`/change-logs/` est read-only).
- Une seule racine active de tableau par household (`uq_electricity_active_root_board_per_household`) ; un circuit ne peut être directement protégé par un RCD pur (`clean()` dans `ElectricCircuit`).
- Règle P3 : `ElectricityBoard.zone` et `UsagePoint.zone` sont non-nullables — à la création sans zone spécifique, rattacher à la zone racine du household.
