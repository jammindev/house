# Parcours 11 — Lot 7 : retrait des trackers de consommation, nourriture des poules via le stock

> Avenant aux parcours 11 (trackers) et 14 (poulailler), cadré le 2026-07-11.
> Défait le lot 6 (#214–#216, `PARCOURS_11_LOT6_TRACKERS_CONSOMMATION.md`).
> Issues : **#255** (chickens backend), **#256** (chickens frontend), **#257**
> (trackers backend), **#258** (trackers frontend + dashboard).

## Le constat

Le lot 6 a ajouté aux trackers un kind `consumption` avec `reserve`,
`rate_per_day` et autonomie (runway). À l'usage, ce kind **réinvente en moins
bien ce que le module stock fait déjà** :

- `Tracker.reserve` et `StockItem.quantity` sont le même concept (« combien il
  me reste de X ») géré deux fois, sans synchronisation : un achat via stock ne
  crédite pas la réserve du tracker, une conso saisie dans le tracker ne
  décrémente pas le stock.
- Les alertes existent en double : stock bas (`min_quantity` → notification) et
  runway faible (tracker → dashboard), sur deux données qui divergent.
- Symptôme concret côté poules : la nourriture achetée via stock n'entre pas
  dans le coût par œuf (limite V1 du parcours 14), et l'archivage d'un tracker
  laisse un lien mort côté `ChickenSettings.feed_tracker` (soft delete
  `is_active=False` → le `SET_NULL` de la FK ne se déclenche jamais, et ni le
  serializer ni `flock_summary` ne filtrent le flag).

## Décisions de cadrage (confirmées avec l'utilisateur le 2026-07-11)

1. **Les trackers reviennent à leur besoin d'origine** : des séries de relevés
   ponctuels (`measure`), sans lien vers d'autres entités métier. Le kind
   `consumption` est **supprimé** (champs `reserve`, `rate_per_day`, runway,
   refill, alerte autonomie, `RunwaysCard`).
2. **La cible générique** (`target_content_type`/`target_object_id`) est
   **supprimée** — jamais exploitée par l'UI (backlog #197 abandonné sur ce
   point). Le **lien projet est conservé** (onglet Trackers du détail projet,
   activement utilisé).
3. **La nourriture des poules se connecte au stock** :
   `ChickenSettings.feed_tracker` → `feed_stock_item` (FK `stock.StockItem`,
   `SET_NULL`). La réserve = `StockItem.quantity`, le réapprovisionnement =
   l'action `purchase` du stock (dépense incluse), l'alerte = statuts
   low/out + notifications stock existants.
4. **Pas de runway pour la nourriture** : « stock bas » sur seuil
   (`min_quantity`) suffit. Plus de saisie de conso au quotidien — on ne
   saisit que les achats. (Idée notée pour plus tard, hors scope : estimer un
   rythme depuis les achats datés `stock_purchase` si le besoin revient.)
5. **Le coût par œuf inclut la nourriture** : `_cost_totals` compte, en plus
   des `chickens_purchase`, les Interactions `stock_purchase` dont la source
   est **l'article de stock actuellement lié**. La limite V1 du parcours 14
   tombe. (Limite acceptée : si on change d'article lié, les achats de
   l'ancien article ne sont plus attribués.)
6. **Données existantes** : les trackers `consumption` sont **convertis en
   `measure`** (historique d'entrées conservé, `reserve`/`rate_per_day` mis à
   null, `entries_summary` recalculé). Le lien `feed_tracker` existant est
   simplement abandonné — l'utilisateur relie un article de stock à la main.

## Découpage

| Lot | Sujet | Issue |
|---|---|---|
| 7a | Chickens backend — `feed_stock_item`, `flock_summary` sur le stock, coût par œuf incluant l'article lié, migration | #255 |
| 7b | Chickens frontend — `FeedCard` + settings sur le stock (picker d'article, achat via `StockPurchaseDialog`), i18n | #256 |
| 7c | Trackers backend — retrait `consumption` + cible générique, migration de conversion, alerts, agent | #257 |
| 7d | Trackers frontend + dashboard — retrait refill/kind/runway, `RunwaysCard`, `AlertsPage`/`TriageSection`, i18n | #258 |

Deux PRs : `feat/chickens-feed-stock` (7a + 7b) d'abord, puis
`refactor/trackers-remove-consumption` (7c + 7d). Ordre imposé : chickens doit
cesser de pointer les trackers avant le retrait du kind.

## Inventaire des points touchés (issu de la cartographie)

**Chickens** : `models.py` (`ChickenSettings.feed_tracker` → `feed_stock_item`),
`serializers.py` (`feed_tracker_detail` → détail article stock, validation =
article du foyer), `services.py::flock_summary` (snapshot stock :
quantité/unité/statut/`min_quantity`) + `_cost_totals`, `FeedCard.tsx`,
`ChickensCard.tsx` (dashboard), `docs/MODULES/chickens.md`.

**Trackers backend** : `models.py` (kind, `reserve`, `rate_per_day`, contrainte
`tracker_target_integrity`, GenericFK), `services.py` (`compute_rate_per_day`,
`runway`, `_adjust_reserve`, branches consommation de
`refresh_tracker_cache`/`build_entries_summary`), `serializers.py`
(`target_*`, `runway_*`, sparkline agrégée par jour), `views.py` (filtres
`?target_type/?target_id/?general`), `apps.py` (writable `reserve`, describe
listable, anchor searchable), `apps/agent/tools.py` (descriptions),
`apps/alerts/services.py::_low_runway_trackers`, `tests/test_consumption.py`,
`docs/MODULES/trackers.md`.

**Trackers frontend** : `RefillDialog.tsx` (supprimé), `TrackerDialog.tsx`
(sélecteur de kind), `TrackerCard.tsx` + `TrackerDetailPage.tsx` (affichage
rythme/réserve/autonomie), `RunwaysCard.tsx` + `DashboardPage.tsx`,
`AlertsPage.tsx` + `TriageSection.tsx` (`low_runway_trackers`),
`lib/api/trackers.ts` + `lib/api/alerts.ts`, clés i18n (4 langues), types API
régénérés (`npm run gen:api:refresh`).

## Définition de done

1. Dans les réglages du poulailler, lier l'article de stock « Nourriture
   poules » → la `FeedCard` affiche quantité/unité/statut de l'article et un
   bouton achat ; l'achat passe par le `purchase` du stock (quantité + dépense
   `stock_purchase`).
2. L'article passe sous `min_quantity` → statut `low_stock` + notification
   stock existante ; la `FeedCard` et le widget dashboard reflètent l'état.
3. Le coût par œuf inclut les achats `stock_purchase` de l'article lié en plus
   des `chickens_purchase`.
4. Supprimer l'article lié côté stock → la fiche poules n'affiche plus rien
   (pas de lien mort — leçon du bug `feed_tracker`).
5. Créer un tracker : plus de choix de kind ni de réserve ; les cards et la
   page détail n'affichent plus rythme/autonomie ; plus de `RunwaysCard` ni
   d'alerte autonomie.
6. Les anciens trackers consommation apparaissent comme des trackers mesure,
   historique intact, `entries_summary` sans en-tête rythme/réserve.
7. `pytest` vert, types API régénérés, i18n propre dans les 4 langues.
