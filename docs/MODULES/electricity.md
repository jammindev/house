# Module — electricity

> Audit : 2026-04-28, complété le 2026-07-05 (parcours 10). Rôle : modéliser le tableau électrique du foyer (tableaux, protections, circuits, points d'usage), son historique, et **analyser la consommation** (compteurs, relevés, imports, agrégation).

## État synthétique

- **Backend** : Présent (architecture + consommation)
- **Frontend** : Complet dans `ui/src/features/electricity/` (5 onglets, dont Consommation avec Recharts)
- **Locales (en/fr/de/es)** : ok
- **Tests** : oui — architecture (`test_models.py`, `test_serializers.py`, `test_views.py`) + consommation (`test_services_consumption.py`, `test_views_consumption.py`, `test_services_imports.py`, `test_views_imports.py`, `test_agent_integration.py`) + `factories.py` + E2E (`e2e/electricity.spec.ts`, `e2e/electricity-consumption.spec.ts`)
- **Migrations** : 11 total

## Modèles & API

- Modèles principaux : `ElectricityBoard`, `ProtectiveDevice` (breaker / RCD / combined / main), `ElectricCircuit`, `UsagePoint`, `CircuitUsagePointLink`, `MaintenanceEvent`, `PlanChangeLog`
- Modèles consommation (parcours 10) : `ElectricityMeter` (tarification base/HP-HC, fuseau IANA du point de comptage), `MeterReading` (relevés d'index, monotonie validée), `ConsumptionRecord` (**pivot générique multi-pays** : Wh entiers, intervalle explicite en minutes, cadran, source `reading`/`import`), `ConsumptionImport` (trace d'audit des imports)
- `ElectricityBoard.zone` et `UsagePoint.zone` sont des FK non-nullables vers `zones.Zone` — rattacher à la zone racine du household si pas de zone spécifique (règle P3 : 1 zone racine par household) — *source : `apps/electricity/models.py:91-95`, `:344-349`*
- Endpoints exposés : `/api/electricity/boards/`, `/protective-devices/`, `/circuits/`, `/usage-points/` (+ `bulk-create/`), `/links/` (+ `deactivate/`), `/maintenance-events/`, `/change-logs/` (read-only)
- Endpoints consommation : `/api/electricity/meters/`, `/meter-readings/`, `GET /consumption/summary/?meter=&granularity=hour|day|month|year&date_from=&date_to=` (agrégation Postgres dans le fuseau du compteur), `/consumption/imports/` (+ `preview/`)
- Permissions : `IsAuthenticated, IsElectricityOwnerWriteMemberRead` (custom — membres lisent, owners écrivent — *source : `apps/electricity/permissions.py`*)

## Notes / décisions produit

- Permissions plus strictes que les autres modules : seul l'owner du household peut écrire (`IsElectricityOwnerWriteMemberRead`) — *source : `apps/electricity/permissions.py:9-32`*.
- Modèle riche en contraintes DB (CheckConstraints sur `position_end`, breaker sans champs RCD, RCD sans curve_type, pole_count valide…) — toucher avec précaution.
- `PlanChangeLog` est un journal d'audit dédié au domaine électrique (`/change-logs/` est read-only).
- Une seule racine active de tableau par household (`uq_electricity_active_root_board_per_household`) ; un circuit ne peut être directement protégé par un RCD pur (`clean()` dans `ElectricCircuit`).
- Règle P3 : `ElectricityBoard.zone` et `UsagePoint.zone` sont non-nullables — à la création sans zone spécifique, rattacher à la zone racine du household.

## Consommation (parcours 10, livré 2026-07-05)

- **Source de vérité des écritures** : `apps/electricity/services.py` — `create/update/delete_meter_reading` (viewset **et** agent y passent), `rebuild_reading_records`, `consumption_summary`, `import_consumption_file`.
- **Relevés → estimations** : le delta entre deux relevés d'un même cadran est matérialisé en `ConsumptionRecord(source='reading')` quotidiens, au prorata des **secondes** par jour calendaire local (DST 23 h/25 h juste — piège : la soustraction de deux datetimes partageant le même ZoneInfo est wall-clock, tout le calcul se fait en UTC). Régénération complète à chaque écriture de relevé.
- **Règles d'agrégation** (`consumption_summary`) : la vue heure ne montre que des données réelles (`source='import'`, pas ≤ 60 min) ; sur un jour local couvert par un import, les estimations sont ignorées (pas de double comptage) ; chaque seau expose `estimated_wh`.
- **Importers** : `apps/electricity/importers/` — registry d'adaptateurs (`BaseImporter.detect/parse` → `NormalizedPoint`). `enedis_csv` (courbe de charge, W moyen, horodate = fin d'intervalle) + `generic_csv` (mapping utilisateur colonnes/unité/pas). Parse intégral avant écriture ; idempotence par `bulk_create(ignore_conflicts)` sur `(meter, register, ts_start, source)`. Un fichier illisible = `ConsumptionImport(status='failed')` en 201 (résultat métier), zéro record.
- **Agent** (`apps.py::ready()`) : `SearchableSpec('meter')`, `ListableSpec('consumption')` avec `amount_of` en kWh (somme via `list_entities`), `ListableSpec('meter_reading')`, `WritableSpec('meter_reading')` create-only (« j'ai relevé 45230 », compteur implicite si unique, undo standard). Limite documentée : la somme `list_entities` ne déduplique pas les sources — filtrer `source='import'` si les deux coexistent.
- **Frontend** : onglet Consommation (`ConsumptionTab.tsx`) — granularité + navigation de période (`useSessionState`), BarChart Recharts empilé par cadran (tokens `--chart-*`), dialogs compteur/relevé/import (preview + mapping générique), relevés récents avec undo. Recharts est entré au projet ici.
- **Limitation connue** : l'onglet n'est accessible que si un tableau électrique existe (empty state global de la page) ; pas de bouton « nouveau compteur » hors état vide (édition via ⋯).
- Docs : `docs/parcours/PARCOURS_10_ANALYSER_LA_CONSOMMATION_ELECTRIQUE.md` + `PARCOURS_10_BACKLOG_TECHNIQUE.md`. V2 différée : #202 (coût €, comparaisons, sync auto, autres fluides).
