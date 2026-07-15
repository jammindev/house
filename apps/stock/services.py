"""
Write-side business logic for stock, shared by the REST viewset and the agent.

The two entry points (`purchase_stock_item`, `record_inventory`) own the full
side-effect chain: quantity recompute, status transition + notification, dated
level reading, and (for a purchase) the linked expense interaction. Both persist
a `StockLevelReading` so the item's quantity always has a matching last reading
— the invariant the consumption curve relies on.

Callers must never mutate `StockItem.quantity` or write a `StockLevelReading`
directly: routing every write through here keeps that invariant true.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from interactions.services import create_expense_interaction

from .models import StockItem, StockLevelReading
from .notifications import notify_stock_status_change


def recompute_status(item: StockItem) -> None:
    """Recompute ``item.status`` in place from its quantity / thresholds.

    Mirrors the transitions historically inlined in the purchase/adjust views:
    out when empty, low when at/under the minimum, expired when past its date,
    and a promotion back to in_stock from a depleted/ordered state otherwise.
    Reserved is left untouched (a manual state).
    """
    if item.quantity <= 0:
        item.status = StockItem.Status.OUT_OF_STOCK
    elif item.min_quantity is not None and item.quantity <= item.min_quantity:
        item.status = StockItem.Status.LOW_STOCK
    elif item.expiration_date and item.expiration_date < timezone.now().date():
        item.status = StockItem.Status.EXPIRED
    elif item.status in [
        StockItem.Status.LOW_STOCK,
        StockItem.Status.OUT_OF_STOCK,
        StockItem.Status.ORDERED,
        StockItem.Status.EXPIRED,
    ]:
        item.status = StockItem.Status.IN_STOCK


def _record_level(
    item: StockItem,
    *,
    quantity: Decimal,
    kind: str,
    reading_at: datetime,
    user,
    source_interaction=None,
) -> StockLevelReading:
    return StockLevelReading.objects.create(
        household_id=item.household_id,
        stock_item=item,
        reading_at=reading_at,
        quantity=quantity,
        kind=kind,
        source_interaction=source_interaction,
        created_by=user,
    )


@transaction.atomic
def purchase_stock_item(
    *,
    item: StockItem,
    user,
    delta: Decimal,
    amount: Decimal | None = None,
    supplier: str = "",
    brand: str = "",
    remaining_before: Decimal | None = None,
    occurred_at: datetime | None = None,
    notes: str = "",
):
    """Compose an inbound stock movement with an expense interaction.

    Increments the item quantity by ``delta`` and creates an
    ``Interaction(type=expense, kind="stock_purchase")`` linked to the item.
    Item-side snapshots (unit_price, purchase_date, supplier, last_restocked_at)
    are best-effort records of the most recent purchase.

    When ``remaining_before`` is provided, the quantity is *recalibrated* to
    ``remaining_before + delta`` (correcting drift), and an ``inventory`` level
    reading is written at that remaining level right before the ``purchase``
    reading of the new total — so the consumption curve shows the descent, then
    the restock jump.

    Returns ``(item, interaction)``.
    """
    delta = Decimal(delta)
    occurred_at = occurred_at or timezone.now()
    supplier = supplier or ""
    brand = brand or ""
    notes = notes or ""

    unit_price = (amount / delta).quantize(Decimal("0.01")) if amount is not None and delta > 0 else None

    old_status = item.status

    # Recalibrate from the measured remaining level when provided.
    if remaining_before is not None:
        remaining_before = Decimal(remaining_before)
        _record_level(
            item,
            quantity=remaining_before,
            kind=StockLevelReading.Kind.INVENTORY,
            reading_at=occurred_at,
            user=user,
        )
        item.quantity = remaining_before + delta
    else:
        item.quantity = Decimal(item.quantity) + delta

    item.last_restocked_at = timezone.now()
    if unit_price is not None:
        item.unit_price = unit_price
    item.purchase_date = occurred_at.date()
    if supplier:
        item.supplier = supplier
    recompute_status(item)
    item.updated_by = user
    item.save()
    notify_stock_status_change(item, old_status, item.status)

    interaction = create_expense_interaction(
        source=item,
        user=user,
        amount=amount,
        unit_price=unit_price,
        supplier=supplier,
        occurred_at=occurred_at,
        notes=notes,
        kind="stock_purchase",
        extra_metadata={
            "stock_item_name": item.name,
            "brand": brand,
            "delta": str(delta),
            "unit": item.unit,
        },
    )

    _record_level(
        item,
        quantity=item.quantity,
        kind=StockLevelReading.Kind.PURCHASE,
        reading_at=occurred_at,
        user=user,
        source_interaction=interaction,
    )

    return item, interaction


@transaction.atomic
def record_inventory(
    *,
    item: StockItem,
    user,
    quantity: Decimal,
    occurred_at: datetime | None = None,
):
    """Set the item quantity to a measured absolute value (an inventory count).

    Unlike ``adjust-quantity`` (a signed delta), this takes the *remaining*
    amount directly — the natural gesture ("I counted, 4 kg left"). Persists an
    ``inventory`` level reading, recomputes status, and notifies. Returns the item.
    """
    quantity = Decimal(quantity)
    occurred_at = occurred_at or timezone.now()

    old_status = item.status
    item.quantity = quantity
    recompute_status(item)
    item.updated_by = user
    item.save()
    notify_stock_status_change(item, old_status, item.status)

    _record_level(
        item,
        quantity=quantity,
        kind=StockLevelReading.Kind.INVENTORY,
        reading_at=occurred_at,
        user=user,
    )

    return item
