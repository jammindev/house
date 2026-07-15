# Module — stock

> Audit : 2026-04-28. Rôle : gérer l'inventaire des consommables et fournitures du foyer (catégories, quantités, péremption).

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet dans `ui/src/features/stock/`
- **Locales (en/fr/de/es)** : ok
- **Tests** : oui — 3 fichiers (`test_api_stock.py`, `test_api_stock_extra.py`, `test_import_supabase_stock.py`)
- **Migrations** : 1 total

## Modèles & API

- Modèles principaux : `StockCategory` (nom, color, emoji, sort_order) ; `StockItem` (quantity, min/max, expiration, status, supplier) ; `StockLevelReading` (niveau daté absolu — socle de la courbe de conso, parcours 18)
- Endpoints exposés : `/api/stock/` (`StockItemViewSet` + actions `adjust-quantity/`, `purchase/`, `inventory/`, `consumption/`), `/api/stock/categories/` (`StockCategoryViewSet` + action `summary/`)
- Permissions : `IsAuthenticated, IsHouseholdMember` (pas de custom)
- **Écritures via `apps/stock/services.py`** (parcours 18, lot 18.1) — source de vérité partagée view + agent : `purchase_stock_item` (recalage quantité, snapshots, relevés, interaction dépense, statut+notif), `record_inventory` (quantité absolue + relevé), `recompute_status` (transitions in/low/out/expired). L'action `purchase/` compose l'`Interaction` expense liée via la FK polymorphe (`create_expense_interaction`, `kind=stock_purchase`, avec `brand` en metadata).
- **`StockLevelReading`** : chaque achat/inventaire persiste un point `(reading_at, quantity, kind)`. Un achat avec `remaining_before` recale la quantité (`remaining_before + delta`) et écrit deux relevés (`inventory` du restant + `purchase` du nouveau total). Invariant : le dernier relevé coïncide avec `StockItem.quantity`. Modèle dédié (pas `metadata`) car les niveaux sont *requêtés/tracés* — même logique que `MeterReading`/`EggLog`.
- **Courbe de consommation** (parcours 18, lot 18.3) : `compute_consumption(item, period)` (`services.py`) dérive des relevés une série de points + un rythme (`rate_per_day`, moyenne des descentes hors sauts d'achat sur les jours calendaires) et une date de rupture (`projected_depletion_date = last_level / rate`). Métriques nulles sous 2 points. Exposé par l'action `consumption/` (`?period=30d|90d|1y|all`). Front : onglet « Consommation » de la fiche (`StockConsumptionTab` + `StockConsumptionChart` recharts, overlay-ready pour la température du lot 18.5).
- **Agent** (parcours 18, lot 18.4) : trois writables déclarés dans `apps.py`, tous adossés à `services.py` (jamais d'ORM brut). `stock_item` (create via `create_stock_item`/`StockItemSerializer` + update + delete-undo) ; `stock_reading` = inventaire absolu (`record_inventory`, **sans undo** — on recorrige par un nouveau relevé, comme `meter_reading`/`tracker_entry`) ; `stock_purchase` = achat (`purchase_stock_item`) **réversible** via `undo_purchase` (supprime la dépense + relevés, restaure la quantité) exposé par l'action `undo-purchase/` et le front `undoStockPurchase`. Le `SearchableSpec` gagne un `related` (`recent_level_readings`) qui injecte les relevés récents dans l'assistant ancré (onglet Assistant de la fiche) pour répondre « à quel rythme / quand serai-je à court ? ». Descriptions des tools étendues dans `apps/agent/tools.py` (`create_entity`/`update_entity`).

## Notes / décisions produit

- Pattern d'ajustement quantitatif via action dédiée `adjust-quantity` avec recalcul de status et `last_restocked_at` — bien isolé côté backend.
- `last_restocked_at` est aussi positionné automatiquement à la création si `status=ORDERED` et `quantity > 0` — *source : `apps/stock/views.py:81-83`*.
- Page détail `/app/stock/:id` (`StockItemDetailPage.tsx`, 2026-07-11) : grille d'infos, historique des achats (interactions filtrées par `source_type=stock.stockitem`), assistant ancré (`EntityAssistant entityType="stock_item"`), actions acheter/modifier/supprimer. Elle rend valide l'`url_template='/app/stock/{id}'` du `SearchableSpec` (les citations de l'agent tombaient en 404 avant).
