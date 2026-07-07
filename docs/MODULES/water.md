# Module — water

> Créé : 2026-07-07. Rôle : suivre la **consommation d'eau** du foyer par relevés manuels du compteur (une date + un index m³), avec les mêmes graphs et la même navigation de période que le module électricité — sans en dupliquer le code.

## État synthétique

- **Backend** : Présent (`apps/water/` — 1 modèle, volontairement minimal)
- **Frontend** : Complet dans `ui/src/features/water/` (page unique, chart partagé)
- **Locales (en/fr/de/es)** : ok (namespace `water.*` + namespace partagé `consumption.*`)
- **Tests** : `apps/water/tests/` (serializers, views, services, agent) + E2E `e2e/water.spec.ts`
- **Migrations** : 1

## Modèles & API

- `WaterReading` (`HouseholdScopedModel`) : `reading_date` (DateField), `index_m3` (Decimal 12,3), unique `(household, reading_date)`. **Pas d'entité compteur, pas de cadran, pas de tarif, pas d'import** — simplification volontaire vs électricité : un foyer = un compteur d'eau implicite.
- Endpoints : `/api/water/readings/` (CRUD), `GET /api/water/consumption/summary/?granularity=day|month|year&date_from=&date_to=`
- Permissions : `IsHouseholdMember` (pattern trackers, pas le permission custom électricité)
- Validation (serializer) : index ≥ 0, monotonie (jamais inférieur au relevé précédent ni supérieur au suivant), un relevé max par date.

## Architecture — décisions

- **Pas de table dérivée** : contrairement à l'électricité (`ConsumptionRecord` régénéré à chaque écriture), la consommation eau est **calculée à la volée** dans `services.consumption_summary` — les relevés sont date-only et peu nombreux, un recalcul par requête est trivial. Même contrat de proratisation : le delta entre deux relevés consécutifs est réparti sur `[date_prev, date_curr)` en litres entiers avec arrondi cumulatif (la somme des parts vaut exactement le delta).
- **Litres entiers dans l'API** (`total_l`), conversion m³ côté UI — miroir exact du contrat Wh/kWh de l'électricité.
- **Source de vérité des écritures** : `apps/water/services.py` — `create_water_reading` / `update_water_reading` passent par `WaterReadingSerializer` ; le viewset (`perform_create`/`perform_update`) **et** les handlers agent appellent ces services. Le delete n'a pas de service (aucun état dérivé à rafraîchir).
- **Granularités** : `day|month|year` seulement — pas de vue horaire (relevés date-only).

## Réutilisation frontend (extraite à l'occasion de ce module)

- `ui/src/components/charts/ConsumptionBarChart.tsx` : **chart générique partagé** (barres empilées Recharts, séries paramétrées `{key,label,color}`, unité paramétrée) — consommé par `electricity/ConsumptionChart.tsx` (wrapper cadrans/kWh) et par `WaterPage` (série unique m³, couleur `--chart-2`).
- `ui/src/lib/period.ts` : helpers de fenêtre de période (`isoDate`, `periodRange`, `shiftAnchor`, `periodLabel`) extraits de `ConsumptionTab` — partagés eau/électricité.
- Clés i18n partagées `consumption.*` (granularity, previousPeriod, nextPeriod, overPeriod, noData) — déplacées depuis `electricity.consumption.*`.
- Page : pattern standard Feature page (PageHeader, FilterPill + `useSessionState`, skeleton `useDelayedLoading`, EmptyState, `useDeleteWithUndo`).

## Agent (`apps/water/apps.py::ready()`)

- `WritableSpec('water_reading')` : create (« j'ai relevé 1250 sur le compteur d'eau », `reading_date` défaut = aujourd'hui, virgule décimale acceptée) + update (`index_m3`, `reading_date`) — les deux via les services. Undo front : `UNDO_HANDLERS` / `UPDATE_UNDO_HANDLERS` dans `ui/src/features/agent/hooks.ts`.
- `ListableSpec('water_reading')` : filtres `date_from` / `date_to` — la consommation se lit comme delta entre deux relevés (pas d'`amount_of` : un index n'est pas un montant).
- Pas de `SearchableSpec` : rien de textuel à indexer sur un relevé.
- Descriptions des tools étendues dans `apps/agent/tools.py` (create/update/list) — seule retouche dans `apps/agent/`.

## Limitations connues / V2 possibles

- Un seul compteur d'eau par foyer (pas d'entité compteur). Si un second compteur devient nécessaire, introduire un modèle `WaterMeter` sur le modèle électricité.
- Pas de coût € (pas de tarif eau) ; pas d'import de données fournisseur.
- Si l'utilisateur veut une vue « depuis toujours », la navigation décennale du mode année la couvre.
