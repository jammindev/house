# Parcours 10 — Backlog technique V1

> **V1 livrée le 2026-07-05** (PRs #204, #205, #206, #207 + E2E/docs). Reste la recette manuelle avec le fichier Enedis réel du foyer (cf. « Check de validation manuelle » du doc produit). Cadrage réalisé le 2026-07-04. Le module électricité modélise l'architecture (tableau, circuits, points d'usage) mais ne contient **aucune donnée de mesure** : pas de compteur, pas de kWh, pas d'endpoint d'agrégation, pas d'upload de fichier de données, et aucune lib de graphiques dans le projet. La preuve de réussite de la V1 : importer la courbe de charge Enedis réelle du foyer et retrouver les mêmes totaux que l'espace client, à toutes les granularités.

## Tableau de bord

| Lot | Sujet | Statut | Issue |
|---|---|---|---|
| 1 | Socle backend — ElectricityMeter / MeterReading / ConsumptionRecord + endpoint summary | ✅ Livré (PR #204) | #198 |
| 2 | Couche importers — registry + adaptateurs `enedis_csv` et `generic_csv` | ✅ Livré (PR #205) | #199 |
| 3 | Frontend — onglet Consommation, charts Recharts, dialogs compteur/relevé/import | ✅ Livré (PR #206) | #200 |
| 4 | Intégration agent — searchable compteur, listable consommation (somme kWh), relevé dictable | ✅ Livré (PR #207) | #201 |

**Issue annexe** : **#202** — sujets V2 délibérément différés (coût €, comparaisons de périodes, sync auto, autres fluides).

## Doc associée

- Doc produit : [PARCOURS_10_ANALYSER_LA_CONSOMMATION_ELECTRIQUE.md](./PARCOURS_10_ANALYSER_LA_CONSOMMATION_ELECTRIQUE.md)
- CLAUDE.md, sections « Pattern standard — Feature page » et « Agent — actions d'écriture »
- Pattern de référence pour le registry importers : `apps/domotics` providers (parcours 09) et `apps/agent/searchables.py`
- Service métier de référence : `apps/tasks/services.py` (contrat view + agent)

## Flow cible

1. créer un compteur (base ou HP/HC), saisir des relevés d'index → consommation estimée jour/mois/année
2. importer le CSV courbe de charge Enedis → granularité horaire réelle, idempotent au ré-import
3. importer n'importe quel CSV via mapping générique (colonne date / colonne valeur / unité / pas)
4. analyser au choix : heure / jour / mois / année, navigation dans le temps, HP/HC distingués
5. agent : « combien a-t-on consommé en juin ? » (somme kWh) et « j'ai relevé 45230 » (création + undo)

## Décisions de cadrage MVP (toutes appliquées V1)

- **Pas de nouvelle app** — tout vit dans `apps/electricity/` (nouvel onglet du module existant, mêmes permissions `IsElectricityOwnerWriteMemberRead` : owner écrit, membres lisent).
- **Modèle pivot neutre** — `ConsumptionRecord(meter, register, ts_start UTC, interval_minutes, energy_wh int, source)` : aucun concept Enedis, aucun pas de temps supposé, Wh entiers (pas de flottants cumulés). Unicité `(meter, register, ts_start)` = la clé d'idempotence des imports.
- **Relevés matérialisés en estimations quotidiennes** — le delta entre deux relevés consécutifs d'un même cadran est réparti au prorata des secondes couvertes par jour calendaire (fuseau du projet) en `ConsumptionRecord(source='reading', interval_minutes=couverture réelle)`. Toute écriture/suppression de relevé **régénère la série dérivée complète** du couple (meter, register) — déterministe, idempotent, et trivial en volume (des dizaines de relevés, pas des milliers).
- **Règle d'honnêteté des granularités** — le endpoint summary n'inclut que les points dont `interval_minutes` ≤ la taille du seau : la vue heure (60) exclut les estimations quotidiennes (1440), les vues jour/mois/année incluent tout. Chaque seau expose aussi `estimated_wh` pour que l'UI signale la part estimée.
- **Agrégation 100 % serveur** — `GET /consumption/summary/` fait `TruncHour/Day/Month/Year` + `Sum(energy_wh)` groupé par cadran, frontières calculées dans le fuseau local (`TIME_ZONE`). ~17 500 points/an au pas 30 min : pas de table d'agrégats pré-calculés.
- **Import via registry d'adaptateurs** — `BaseImporter` (`key`, `label`, `detect(sample)`, `parse(text, options) -> Iterable[NormalizedPoint]`) + registry, même philosophie que les providers domotics. `NormalizedPoint(ts_start, interval_minutes, energy_wh, register)` : l'adaptateur possède le parsing, le service possède l'upsert.
- **Import idempotent par construction** — `bulk_create(ignore_conflicts=True)` sur la clé naturelle + comptage créés/ignorés par différence. Ré-importer un fichier = 0 création.
- **`enedis_csv`** : export « courbe de charge » de l'espace client (colonnes `Horodate;Valeur`, valeur = **puissance moyenne en W** sur le pas ; pas déduit de deux horodatages consécutifs, défaut 30 min ; `energy_wh = W × pas/60`). **Le format exact doit être re-vérifié contre le fichier réel du foyer pendant l'implémentation** — le parser tolère les lignes d'en-tête/métadonnées et échoue explicitement sinon.
- **`generic_csv`** : options utilisateur `{timestamp_column, value_column, unit ∈ wh|kwh|w_avg, interval_minutes, delimiter?, register?}` — couvre tout pays sans adaptateur dédié.
- **Échec d'import ≠ import partiel silencieux** — le parsing est validé avant écriture ; une ligne illisible fait échouer l'import avec un message (ligne + raison), trace `ConsumptionImport(status='failed')`.
- **Index décroissant refusé** — un relevé dont l'index est inférieur au relevé précédent (ou supérieur au suivant) du même cadran est rejeté par le serializer avec message clair. Le rollover de compteur est hors scope V1.
- **Recharts entre au projet** (`recharts` dans package.json) — BarChart empilé par cadran, première lib de charts, resservira au parcours 08.
- **Agent : trois registries, zéro modif de logique agent** — `SearchableSpec('meter')` ; `ListableSpec('consumption')` avec filtres (`meter`, `from`, `to`, `register`, `source`) et `amount_of` = kWh en Decimal (le rendu `sum_amount` du tool est sans devise — vérifié) → répond à « combien en juin » ; `WritableSpec('meter_reading')` create-only branché sur le service (undo standard). Seule retouche `apps/agent/` : les **descriptions** des tools.
- **`pytest` local : `TEST_DATABASE_NAME=test_house`** (cf. mémoire projet).

## Format Enedis — référence à vérifier

Export depuis l'espace client Enedis (*Suivre mes mesures → Télécharger mes données → Courbe de charge*). Attendu : CSV `;`, en-tête de métadonnées possible, puis lignes `Horodate;Valeur` avec horodatage local ISO et valeur en W (puissance moyenne sur le pas, 30 min par défaut). Points de vigilance : encodage (UTF-8 BOM fréquent), lignes vides de fin, valeur vide (trou de mesure → ignorer la ligne), changement d'heure (horodatages localisés). **Caler le parser sur le fichier réel du foyer, et archiver un extrait anonymisé dans les fixtures de test.**

## Lot 1 — Socle backend (#198)

### But

Les trois modèles, la dérivation relevés → estimations, l'endpoint d'agrégation. Livrable : analyse jour/mois/année via curl avec des relevés saisis.

### Modèles (tous `HouseholdScopedModel`, PK UUID, dans `apps/electricity/models.py`)

- **`ElectricityMeter`** (`electricity_meters`) : `name`, `serial_number` (blank), `zone` FK SET_NULL null, `tariff_type` choices (`base`, `hp_hc`), `notes`, `is_active`.
- **`MeterReading`** (`electricity_meter_readings`) : `meter` FK CASCADE, `register` choices (`base`, `hp`, `hc`), `reading_at` DateTimeField, `index_kwh` Decimal(12,3). Unique `(meter, register, reading_at)`. Validation serializer : cohérence cadran/tarification du compteur + monotonie de l'index entre voisins.
- **`ConsumptionRecord`** (`electricity_consumption_records`) : `meter` FK CASCADE, `register`, `ts_start` DateTimeField (UTC), `interval_minutes` PositiveIntegerField, `energy_wh` PositiveBigIntegerField, `source` choices (`reading`, `import`). Unique `(meter, register, ts_start)`, index `(household, meter, ts_start)`.

### Services (`apps/electricity/services.py` — nouveau, point d'entrée unique view + agent)

`create_meter` / `update_meter`, `create_meter_reading(household, user, ...)` (serializer + `rebuild_reading_records`), `delete_meter_reading`, `rebuild_reading_records(meter, register)` (delete + régénération de la série `source='reading'`), `consumption_summary(household, meter, granularity, date_from, date_to)` (retourne les seaux pivotés par cadran + `total_wh` + `estimated_wh`).

### Endpoints (`/api/electricity/`)

CRUD `/meters/` ; CRUD `/meter-readings/` (filtre `?meter=`) ; `GET /consumption/summary/?meter=&granularity=hour|day|month|year&date_from=&date_to=`. Permission existante du module.

### Critères

Monotonie d'index refusée dans les deux sens ; deltas répartis au prorata (période à cheval sur deux mois → chaque mois reçoit sa part) ; recalcul complet sur update/delete de relevé ; summary : seaux exacts aux 4 granularités, frontières en fuseau local, exclusion des estimations en vue heure, pivot par cadran ; factories + tests modèles/serializers/services/views.

## Lot 2 — Couche importers (#199)

### But

Le contrat multi-fournisseurs et ses deux premiers adaptateurs, testés contre des payloads réels. Livrable : la courbe de charge Enedis réelle importée via curl, ré-import = 0 création.

### Fichiers

- `apps/electricity/importers/base.py` — dataclass `NormalizedPoint`, exceptions (`ImporterError`, `ImporterFormatError`), ABC `BaseImporter` (`key`, `label`, `detect`, `parse`)
- `apps/electricity/importers/registry.py` — `register` / `get_importer` / `importer_choices` / `detect_importer(sample)`
- `apps/electricity/importers/enedis_csv.py`, `apps/electricity/importers/generic_csv.py`
- Modèle **`ConsumptionImport`** (`electricity_consumption_imports`) : `meter` FK, `provider`, `filename`, `status` (`completed`/`failed`), `created_count`, `skipped_count`, `error`. + FK nullable `source_import` sur `ConsumptionRecord` (migration dédiée).
- Service `import_consumption_file(household, user, meter, uploaded_file, provider=None, options=None)` — détection si `provider` absent, parse intégral **avant** écriture, upsert `ignore_conflicts`, trace `ConsumptionImport`.
- Endpoints : `POST /consumption/imports/` (multipart : `file`, `meter`, `provider?`, `options?` JSON) → 201 avec compte-rendu ; `GET /consumption/imports/` (historique) ; `POST /consumption/imports/preview/` (premières lignes + provider détecté, pour le mapping générique).

### Critères

Détection auto Enedis sur fichier réel ; conversion W moyen → Wh juste (recoupée avec un total espace client) ; BOM/lignes vides/valeurs manquantes tolérés ; ligne invalide → échec explicite avec numéro de ligne, `status='failed'`, zéro record écrit ; ré-import = `created=0, skipped=n` ; generic_csv avec les 3 unités ; fixtures = extrait Enedis anonymisé.

## Lot 3 — Frontend (#200)

### But

**Preuve V1 du parcours : la courbe de charge réelle visible par heure/jour/mois/année dans l'app.**

### Fichiers

`package.json` (+`recharts`) ; `ui/src/lib/api/electricity.ts` (meters, readings, summary, imports) ; `ui/src/features/electricity/{ConsumptionTab.tsx, ConsumptionChart.tsx, MeterDialog.tsx, ReadingDialog.tsx, ImportDialog.tsx}` + extension `hooks.ts` (query keys consommation) et `ElectricityPage.tsx` (5e onglet) ; i18n 4 locales `electricity.consumption.*` ; `npm run gen:api:refresh`.

### Points clés

Sélecteur de granularité en `FilterPill` + navigation ◀ période ▶ (état ancre + granularité → `date_from`/`date_to` calculés, persistés via `useSessionState`) ; BarChart empilé par cadran (tokens du design-system pour les couleurs) ; part estimée signalée ; total kWh de la période ; sélecteur de compteur si plusieurs ; liste des relevés récents avec `CardActions` (éditer / supprimer avec undo) ; dialog d'import : upload → preview → provider détecté ou mapping manuel (colonnes/unité/pas) → compte-rendu créés/ignorés ; EmptyState → CTA créer compteur puis relevé/import ; pattern Feature page du CLAUDE.md ; mobile OK.

## Lot 4 — Intégration agent (#201)

### But

L'agent répond aux questions de consommation et enregistre un relevé dicté. Tout depuis `apps/electricity/apps.py::ready()` (à créer — l'app n'a pas de `ready()` aujourd'hui), zéro modif de logique dans `apps/agent/`.

### Contenu

- `SearchableSpec(entity_type='meter', search_fields=('name', 'serial_number', 'notes'), url_template='/app/electricity?tab=consumption')`
- `ListableSpec(entity_type='consumption', model=ConsumptionRecord, filters=(meter, from, to, register, source), amount_of=lambda r: Decimal(r.energy_wh) / 1000, describe=…)` → `sum_amount` = kWh sur l'ensemble filtré
- `ListableSpec(entity_type='meter_reading', …)` (relevés récents)
- `WritableSpec(entity_type='meter_reading', create=_create_reading_from_agent → services.create_meter_reading, label_attr dérivé, url_template onglet consommation)` — create-only V1
- Étendre les **descriptions** de `create_entity` / `list_entities` (`apps/agent/tools.py`) : champs du relevé (meter par défaut si unique, register, index_kwh, reading_at défaut maintenant) et unité du `sum_amount` (kWh) pour `consumption`
- `UNDO_HANDLERS` : entrée `meter_reading` (`ui/src/features/agent/hooks.ts`) — le DELETE déclenche le recalcul côté serveur

### Critères

`dispatch('create_entity', meter_reading)` == création REST (mêmes side-effects, y compris régénération des estimations) ; refus index décroissant remonté proprement à l'agent ; `list_entities consumption from=2026-06-01 to=2026-06-30` → somme kWh juste ; compteur trouvé par `search_household` ; undo supprime le relevé ; recette manuelle dans `/app/agent/`.

## Ordre recommandé d'implémentation

1. Lot 1 — socle (relevés + summary, testable via curl)
2. Lot 2 — importers (la courbe Enedis réelle entre en base)
3. Lot 3 — frontend (**preuve V1 : le graphique heure/jour/mois/année**)
4. Lot 4 — agent (« combien en juin ? » dans le chat)

Branches : une feature branch par lot (`feat/electricity-consumption-core`, `feat/electricity-consumption-import`, `feat/electricity-consumption-ui`, `feat/electricity-consumption-agent`), PR vers `main`, merge dans l'ordre.

## Points de vigilance

- **fuseau et changement d'heure** : répartition au prorata des **secondes** (jamais « ÷ nb jours × 24 h ») ; les journées de 23 h/25 h doivent tomber juste ; `USE_TZ` est actif, tout `ts_start` stocké en UTC, frontières de seau en fuseau local
- **ne jamais laisser un concept Enedis fuiter** hors de `importers/enedis_csv.py` (ni dans les modèles, ni dans l'API, ni dans l'UI)
- **le format Enedis réel prime sur la doc** — caler `detect`/`parse` sur le fichier du foyer, fixer un extrait anonymisé en fixture
- **parse intégral avant écriture** : jamais d'import partiel silencieux ; l'échec doit être actionnable (n° de ligne)
- **la vue heure ne doit jamais montrer une estimation quotidienne** — c'est la règle produit n° 2, la tester explicitement
- **`amount_of` itère en Python sur l'ensemble filtré** (`apps/agent/tools.py`) — acceptable à ~17 k records/an, mais borner les filtres par défaut si un foyer accumule plusieurs années ; à surveiller, pas à optimiser prématurément
- **`ready()` de l'app electricity n'existe pas encore** — le créer sans casser les imports circulaires (imports locaux dans les callbacks, comme `apps/tasks/apps.py`)
- `pytest` local : `TEST_DATABASE_NAME=test_house`

## Définition de done technique

1. relevés saisis → estimations quotidiennes justes, y compris période à cheval sur deux mois et changement d'heure
2. CSV Enedis réel importé, totaux identiques à l'espace client aux 4 granularités, ré-import = 0 création
3. CSV générique importé via mapping (3 unités testées)
4. la vue heure exclut les estimations ; `estimated_wh` exposé et signalé dans l'UI
5. l'agent somme les kWh d'une période et crée un relevé dicté (undo OK), via les mêmes services que le REST
6. i18n 4 langues, lint propre, pytest vert (nouveaux tests des 4 lots inclus), E2E du flow relevé + analyse
