# Module — stock

> Audit : 2026-04-27. Rôle : gérer l'inventaire des consommables et fournitures du foyer (catégories, quantités, péremption).

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

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.
- _aucun item identifié_

## À faire (backlog)

> Features identifiées non encore commencées.
- _aucun item identifié_

## À améliorer

> Refacto, perf, UX, qualité de code.
- [ ] Recalcul du status (`IN_STOCK` / `LOW_STOCK` / `OUT_OF_STOCK` / `EXPIRED`) uniquement dans `adjust_quantity` ; il n'est pas mis à jour automatiquement lors d'un PATCH classique sur `quantity`/`expiration_date` — *source : `apps/stock/views.py:88-114`*
- [ ] Pas de signal/cron pour passer automatiquement les items à `EXPIRED` après leur date — *source : `apps/stock/views.py:106-107` (logique présente uniquement à l'ajustement)*
- [ ] `StockCategory.on_delete=PROTECT` empêche la suppression d'une catégorie utilisée mais aucun message UX dédié vérifié — *source : `apps/stock/models.py:42`*

## Notes

- Module récent et stable, peu de backlog actif (aucun retour utilisateur dans `URGENT.md`, `TO_FIX.md`, `GITHUB_ISSUES_BACKLOG.md`, `ELECTRICTY_RETOUR.md`).
- Pattern d'ajustement quantitatif via action dédiée `adjust-quantity` avec recalcul de status et `last_restocked_at` — bien isolé côté backend.
- `last_restocked_at` est aussi positionné automatiquement à la création si `status=ORDERED` et `quantity > 0` — *source : `apps/stock/views.py:81-83`*.
