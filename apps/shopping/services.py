"""Shopping list write services — single source of truth.

Both the REST viewset and the agent's ``create_entity`` / ``update_entity`` tools
go through these functions so validation (via ``ShoppingListItemSerializer``) and
the stock-link dedup rule live in one place — never two write paths, never raw
ORM in the agent handler. Mirrors ``tasks.services`` / ``stock.services``.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from stock.models import StockItem

from .models import ShoppingListItem
from .serializers import ShoppingListItemSerializer


def _to_decimal(value):
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _suggested_quantity(stock_item: StockItem):
    """How much to buy: refill up to ``max_quantity`` when known, else the seuil.

    Returns a positive ``Decimal`` or ``None`` (let the user decide).
    """
    if stock_item.max_quantity is not None:
        gap = stock_item.max_quantity - (stock_item.quantity or Decimal(0))
        return gap if gap > 0 else stock_item.max_quantity
    return stock_item.min_quantity


def create_list_item(
    household,
    user,
    *,
    label: str,
    quantity=None,
    unit: str = "",
    note: str = "",
    stock_item: StockItem | None = None,
) -> ShoppingListItem:
    """Create one shopping list line. Validation goes through the serializer."""
    payload: dict = {"label": (label or "").strip()}
    qty = _to_decimal(quantity)
    if qty is not None:
        payload["quantity"] = qty
    if unit:
        payload["unit"] = unit
    if note:
        payload["note"] = note
    if stock_item is not None:
        payload["stock_item"] = getattr(stock_item, "pk", stock_item)

    serializer = ShoppingListItemSerializer(
        data=payload, context={"household_id": household.id}
    )
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


def add_stock_item_to_list(
    household,
    user,
    stock_item: StockItem,
    *,
    quantity=None,
    note: str = "",
) -> tuple[ShoppingListItem, bool]:
    """Add ``stock_item`` to the list, deduped (Lot 2).

    If an *unchecked* line already links this stock item, return it untouched
    (``created=False``) — no duplicate. Otherwise create a linked line, defaulting
    the quantity to a sensible refill amount when the caller gives none.
    """
    existing = ShoppingListItem.objects.filter(
        household_id=household.id, stock_item=stock_item, checked_at__isnull=True
    ).first()
    if existing is not None:
        return existing, False

    qty = _to_decimal(quantity)
    if qty is None:
        qty = _suggested_quantity(stock_item)

    item = create_list_item(
        household,
        user,
        label=stock_item.name,
        quantity=qty,
        unit=stock_item.unit or "",
        note=note,
        stock_item=stock_item,
    )
    return item, True


def update_list_item(household, user, item: ShoppingListItem, *, fields: dict) -> ShoppingListItem:
    """Update a list line — shared by the REST PATCH and the agent update tool."""
    allowed = {"label", "quantity", "unit", "note", "checked", "sort_order"}
    payload = {k: v for k, v in fields.items() if k in allowed}
    serializer = ShoppingListItemSerializer(
        item, data=payload, partial=True, context={"household_id": household.id}
    )
    serializer.is_valid(raise_exception=True)
    return serializer.save(updated_by=user)


def delete_list_item(item: ShoppingListItem) -> None:
    item.delete()


def resolve_list_item(household, raw_id) -> ShoppingListItem | None:
    """Household-scoped list item lookup for update/delete."""
    return ShoppingListItem.objects.filter(household_id=household.id, pk=raw_id).first()


def resolve_stock_item_hint(household, hint) -> StockItem | None:
    """Best-effort resolution of a stock item from an id or a case-insensitive name.

    Used by the agent to link a list item to what the household already stocks.
    Returns ``None`` (rather than raising) when nothing matches — the caller falls
    back to a free-text line.
    """
    raw = (str(hint) if hint is not None else "").strip()
    if not raw:
        return None
    qs = StockItem.objects.filter(household_id=household.id)
    from .services import _looks_like_uuid  # local import keeps the helper private

    if _looks_like_uuid(raw):
        item = qs.filter(pk=raw).first()
        if item is not None:
            return item
    return qs.filter(name__iexact=raw).first()


def _looks_like_uuid(value: str) -> bool:
    import uuid

    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False
