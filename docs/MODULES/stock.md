# Module — stock

> Audit : 2026-04-28. Rôle : gérer l'inventaire des consommables et fournitures du foyer (catégories, quantités, péremption).

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet dans `ui/src/features/stock/`
- **Locales (en/fr/de/es)** : ok
- **Tests** : oui — 3 fichiers (`test_api_stock.py`, `test_api_stock_extra.py`, `test_import_supabase_stock.py`)
- **Migrations** : 1 total

## Modèles & API

- Modèles principaux : `StockCategory` (nom, color, emoji, sort_order) ; `StockItem` (quantity, min/max, expiration, status, supplier)
- Endpoints exposés : `/api/stock/` (`StockItemViewSet` + action `adjust-quantity/`), `/api/stock/categories/` (`StockCategoryViewSet` + action `summary/`)
- Permissions : `IsAuthenticated, IsHouseholdMember` (pas de custom)

## Notes / décisions produit

- Pattern d'ajustement quantitatif via action dédiée `adjust-quantity` avec recalcul de status et `last_restocked_at` — bien isolé côté backend.
- `last_restocked_at` est aussi positionné automatiquement à la création si `status=ORDERED` et `quantity > 0` — *source : `apps/stock/views.py:81-83`*.
