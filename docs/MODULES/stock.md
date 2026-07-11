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
- Endpoints exposés : `/api/stock/` (`StockItemViewSet` + actions `adjust-quantity/` et `purchase/`), `/api/stock/categories/` (`StockCategoryViewSet` + action `summary/`)
- Permissions : `IsAuthenticated, IsHouseholdMember` (pas de custom)
- L'action `purchase/` compose ajustement de quantité + `Interaction` expense liée via la FK polymorphe (`create_expense_interaction`, `kind=stock_purchase`)

## Notes / décisions produit

- Pattern d'ajustement quantitatif via action dédiée `adjust-quantity` avec recalcul de status et `last_restocked_at` — bien isolé côté backend.
- `last_restocked_at` est aussi positionné automatiquement à la création si `status=ORDERED` et `quantity > 0` — *source : `apps/stock/views.py:81-83`*.
- Page détail `/app/stock/:id` (`StockItemDetailPage.tsx`, 2026-07-11) : grille d'infos, historique des achats (interactions filtrées par `source_type=stock.stockitem`), assistant ancré (`EntityAssistant entityType="stock_item"`), actions acheter/modifier/supprimer. Elle rend valide l'`url_template='/app/stock/{id}'` du `SearchableSpec` (les citations de l'agent tombaient en 404 avant).
