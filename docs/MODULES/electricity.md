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

## Notes / décisions produit

- Permissions plus strictes que les autres modules : seul l'owner du household peut écrire (`IsElectricityOwnerWriteMemberRead`) — *source : `apps/electricity/permissions.py:9-32`*.
- Modèle riche en contraintes DB (CheckConstraints sur `position_end`, breaker sans champs RCD, RCD sans curve_type, pole_count valide…) — toucher avec précaution.
- `PlanChangeLog` est un journal d'audit dédié au domaine électrique (`/change-logs/` est read-only).
- Une seule racine active de tableau par household (`uq_electricity_active_root_board_per_household`) ; un circuit ne peut être directement protégé par un RCD pur (`clean()` dans `ElectricCircuit`).
- Règle P3 : `ElectricityBoard.zone` et `UsagePoint.zone` sont non-nullables — à la création sans zone spécifique, rattacher à la zone racine du household.
