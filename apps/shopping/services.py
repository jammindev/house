"""Shopping list write services — single source of truth.

Both the REST viewset and the agent's ``create_entity`` / ``update_entity`` tools
go through these functions so validation (via ``ShoppingListItemSerializer``) and
the stock-link dedup rule live in one place — never two write paths, never raw
ORM in the agent handler. Mirrors ``tasks.services`` / ``stock.services``.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework.exceptions import ValidationError

from stock.models import StockItem

from .models import ShoppingListItem, ShoppingSuggestionDismissal
from .serializers import ShoppingListItemSerializer

_LOW_STATUSES = (StockItem.Status.LOW_STOCK, StockItem.Status.OUT_OF_STOCK)


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


# --- Lot 3: suggestions from low stock ---------------------------------------

def suggested_quantity(stock_item: StockItem):
    """Public accessor for the refill quantity proposed for a stock item."""
    return _suggested_quantity(stock_item)


def list_suggestions(household) -> list[StockItem]:
    """Stock items to *suggest* adding to the list (Lot 3).

    An item qualifies when it is low/out of stock, is not already on an unchecked
    list line, and has not been dismissed — a dismissal counting only while it is
    still "fresh" (the item hasn't been restocked since it was dismissed, i.e.
    ``last_restocked_at`` is not newer than ``dismissed_at``). A new depletion
    cycle therefore re-suggests naturally.
    """
    # "Not already on the list" covers both to-buy and picked lines: an item
    # sitting in the "Picked" section is still on the list, so don't re-suggest it.
    on_list_ids = set(
        ShoppingListItem.objects.filter(
            household_id=household.id, stock_item__isnull=False
        ).values_list("stock_item_id", flat=True)
    )
    dismissals = {
        d.stock_item_id: d.dismissed_at
        for d in ShoppingSuggestionDismissal.objects.filter(household_id=household.id)
    }
    items = (
        StockItem.objects.filter(household_id=household.id, status__in=_LOW_STATUSES)
        .select_related("category")
        .order_by("name")
    )

    suggestions: list[StockItem] = []
    for item in items:
        if item.id in on_list_ids:
            continue
        dismissed_at = dismissals.get(item.id)
        if dismissed_at is not None:
            restocked = item.last_restocked_at
            if restocked is None or restocked <= dismissed_at:
                continue  # dismissal still fresh — stay hidden
        suggestions.append(item)
    return suggestions


def dismiss_suggestion(household, user, stock_item: StockItem) -> ShoppingSuggestionDismissal:
    """Hide ``stock_item`` from suggestions until it is restocked and drops again."""
    dismissal, _ = ShoppingSuggestionDismissal.objects.update_or_create(
        household=household,
        stock_item=stock_item,
        defaults={"created_by": user, "updated_by": user},
    )
    return dismissal


# --- Lot 4: commit a checked line back into the stock -------------------------

@transaction.atomic
def commit_item_to_stock(
    household,
    user,
    item: ShoppingListItem,
    *,
    delta,
    amount=None,
    supplier: str = "",
    occurred_at=None,
    notes: str = "",
    category=None,
    unit: str | None = None,
) -> StockItem:
    """Turn a shopping line into a stock purchase (Lot 4), then remove the line.

    - **Linked** line (``item.stock_item`` set) → records a purchase on that item.
    - **Free-text** line → creates the stock item first (``category`` required),
      then records the purchase.

    Reuses ``stock.services`` (never raw ORM): the purchase reincrements the stock
    and creates the linked expense interaction. Atomic — a failure leaves both the
    stock and the list untouched. Returns the (created or existing) stock item.
    """
    from stock.services import create_stock_item, purchase_stock_item, resolve_category

    delta_dec = _to_decimal(delta)
    if delta_dec is None or delta_dec <= 0:
        raise ValidationError({"delta": "A positive purchased quantity is required."})

    stock_item = item.stock_item
    if stock_item is None:
        if category is None or str(category).strip() == "":
            raise ValidationError(
                {"category": "A category is required to create the stock item."}
            )
        resolved = category if hasattr(category, "pk") else resolve_category(household, category)
        stock_item = create_stock_item(
            household,
            user,
            category=resolved,
            name=item.label,
            unit=(unit or item.unit or "unit"),
            quantity=0,
        )

    purchase_stock_item(
        item=stock_item,
        user=user,
        delta=delta_dec,
        amount=_to_decimal(amount),
        supplier=supplier or "",
        occurred_at=occurred_at,
        notes=notes or "",
    )
    item.delete()
    return stock_item
