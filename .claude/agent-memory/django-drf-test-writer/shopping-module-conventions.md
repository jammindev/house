---
name: shopping-module-conventions
description: URL names, viewset behaviors, agent parity contract, and test gotchas for the shopping list module
metadata:
  type: user
---

## URL names

Router basename: `shopping-item`
- List: `shopping-item-list`
- Detail: `shopping-item-detail` (args=[item.id])
- Custom actions: `shopping-item-from-stock`, `shopping-item-bulk-delete`

## Model

`ShoppingListItem(HouseholdScopedModel)` — UUID pk, `label`, `quantity` (Decimal nullable), `unit`, `note`, `stock_item` FK (SET_NULL to `stock.StockItem`), `checked_at` (DateTimeField nullable), `sort_order`.

`.checked` property = `checked_at is not None` (read-only Python property, not a DB field).

## Serializer — checked ↔ checked_at

`checked` is a writable boolean on the serializer that maps to `checked_at`:
- `checked=True` → stamps `checked_at = now()`
- `checked=False` → clears `checked_at = None`
- Raw `checked_at` is exposed as read-only for display/sorting.

## Critical viewset gotcha: checked is NOT passed through on REST create

`perform_create` calls `create_list_item(...)` with explicit kwargs (label, quantity, unit, note, stock_item). The `checked` kwarg is NOT forwarded. Items created via REST POST are always unchecked regardless of the `checked` payload field. Use PATCH to check an item after creation.

The `perform_update` correctly routes through `update_list_item(fields=serializer.validated_data)` which includes `checked`.

## from-stock action

`POST /api/shopping/items/from-stock/` — adds a StockItem-linked line, deduped.
- Returns `already_in_list=true` + HTTP 200 when an unchecked line already exists for that stock item.
- Returns `already_in_list=false` + HTTP 201 on a new line.
- Dedup only considers unchecked lines — a checked (fulfilled) line does NOT prevent creating a new unchecked one.
- Suggested quantity = `max_quantity - quantity` when `max_quantity` is set and gap > 0; else falls back to `min_quantity`.
- Caller can override the suggested quantity by passing `quantity` in the body.
- Cross-household stock item → HTTP 400 `{"stock_item": "Invalid stock item or access denied."}`.

## bulk-delete action

`POST /api/shopping/items/bulk-delete/` — deletes by list of ids.
- Scoped to `request.household` via `get_queryset()` — cross-household ids are silently ignored (not 403).
- `ids` must be a list; passing a non-list string → HTTP 400 `{"ids": "Expected a list of ids."}`.
- Returns `{"deleted": N}` with HTTP 200.

## Agent parity contract

`_create_shopping_item_from_agent` in `apps/shopping/apps.py`:
1. If `anchor` is `("stock_item", <id>)`, resolve the stock item from that id.
2. If no anchor, try to resolve `fields.get("stock_item")` or `fields.get("label")` as a stock item hint (by UUID or case-insensitive name, scoped to the household).
3. If a stock item is found → call `add_stock_item_to_list` (deduped, same service as from-stock).
4. Otherwise → `create_list_item` (free-text).

The dedup in the agent path is identical to the REST from-stock: exactly one unchecked line per stock item per household.

Cross-household stock items are NOT reachable from the agent (resolve_stock_item_hint scopes to household).

## Agent handler behaviors

- `_delete_shopping_item_from_agent` raises `LookupError` (not ValueError) when item not found or wrong household.
- `_update_shopping_item_from_agent` uses `update_list_item(fields=...)` — same service as REST PATCH.
- Entity types registered: writable `shopping_item` (create/update/delete), searchable `shopping_item`.

## Permissions

- `IsHouseholdMember` — both owners and members can read and write (no owner-only restriction).
- Anonymous → HTTP 401.
- Cross-household detail → HTTP 404 (queryset-scoped, not 403).
- Cross-household from-stock → HTTP 400 (explicit stock item validation).
- Cross-household bulk-delete ids → silently ignored (scoped queryset.filter).
