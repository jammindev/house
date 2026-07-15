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

from datetime import datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from interactions.services import create_expense_interaction

from .models import StockItem, StockLevelReading
from .notifications import notify_stock_status_change

# Selectable windows for the consumption curve. None = full history.
CONSUMPTION_PERIOD_DAYS: dict[str, int | None] = {
    "30d": 30,
    "90d": 90,
    "1y": 365,
    "all": None,
}


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


def resolve_category(household, raw: str):
    """Resolve a stock category by id or (case-insensitive) name within a household.

    Raises ``ValueError`` when unknown or ambiguous — the agent surfaces the hint
    and never creates a category silently.
    """
    from .models import StockCategory

    raw = (raw or "").strip()
    if not raw:
        raise ValueError("a category is required")

    qs = StockCategory.objects.filter(household_id=household.id)
    match = qs.filter(pk=raw).first() if _looks_like_uuid(raw) else None
    if match is None:
        by_name = list(qs.filter(name__iexact=raw)[:2])
        if len(by_name) > 1:
            raise ValueError(f"several categories match {raw!r}; be more specific")
        match = by_name[0] if by_name else None
    if match is None:
        raise ValueError(f"no stock category named {raw!r} — create it first")
    return match


def _looks_like_uuid(value: str) -> bool:
    from uuid import UUID

    try:
        UUID(str(value))
        return True
    except (ValueError, TypeError):
        return False


def create_stock_item(household, user, *, category, **fields):
    """Create a StockItem through ``StockItemSerializer`` (validation + scope).

    Shared by the agent's ``create_entity``. ``category`` is a StockCategory
    instance already resolved to the household. Extra ``fields`` (name, unit,
    quantity, min_quantity, notes, zone) are passed to the serializer as-is.
    """
    from .serializers import StockItemSerializer

    data = {"category": str(category.pk), **{k: v for k, v in fields.items() if v is not None}}
    serializer = StockItemSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


def resolve_stock_item(household, raw_id):
    """Household-scoped stock item lookup for the agent's ``update_entity``."""
    return StockItem.objects.filter(household_id=household.id, pk=raw_id).first()


def update_stock_item(household, user, instance, fields):
    """Partial update of a StockItem through its serializer (agent ``update_entity``)."""
    from .serializers import StockItemSerializer

    serializer = StockItemSerializer(instance, data=fields, partial=True, context={"request": None})
    serializer.is_valid(raise_exception=True)
    return serializer.save(updated_by=user)


@transaction.atomic
def undo_purchase(*, household, user, interaction_id) -> None:
    """Reverse a ``stock_purchase`` — the undo of ``purchase_stock_item``.

    Deletes the expense interaction and the ``purchase`` level reading it created,
    and subtracts the purchased ``delta`` from the item quantity (recomputing the
    status). Raises ``LookupError`` when the purchase is already gone so a double
    undo is idempotent.

    Limitation: an ``inventory`` reading written from a ``remaining_before`` count
    is a real measurement and is intentionally kept (not linked to the purchase).
    """
    from interactions.models import Interaction

    interaction = (
        Interaction.objects.filter(
            household_id=household.id, id=interaction_id, metadata__kind="stock_purchase"
        )
        .first()
    )
    if interaction is None:
        raise LookupError(f"no stock purchase {interaction_id} in this household")

    item = interaction.source  # the StockItem via the polymorphic FK
    delta = Decimal(str((interaction.metadata or {}).get("delta") or "0"))

    StockLevelReading.objects.filter(source_interaction=interaction).delete()
    interaction.delete()

    if item is not None:
        item.quantity = max(Decimal("0"), Decimal(item.quantity) - delta)
        recompute_status(item)
        item.updated_by = user
        item.save()


def recent_level_readings(item: StockItem, *, limit: int = 12):
    """The item's most recent level readings (for the anchored assistant context)."""
    return list(item.level_readings.order_by("-reading_at", "-created_at")[:limit])


def compute_consumption(item: StockItem, *, period: str = "90d") -> dict:
    """Build the consumption curve of an item + derived depletion metrics.

    Returns the dated level points over the selected window plus a burn rate and
    a projected depletion date. The rate is derived from the *descents* between
    consecutive readings (restock jumps upward are excluded); the honest daily
    average is ``total consumed / calendar days spanned``. Both metrics are
    ``None`` when there are fewer than two points to interpolate.

    Shape::

        {
          "period": "90d",
          "points": [{"date": iso, "quantity": float, "kind": str}, ...],
          "last_level": float,
          "points_count": int,
          "rate_per_day": float | None,
          "projected_depletion_date": iso date | None,
        }
    """
    period_days = CONSUMPTION_PERIOD_DAYS.get(period, 90)

    readings = StockLevelReading.objects.filter(stock_item=item)
    if period_days is not None:
        cutoff = timezone.now() - timedelta(days=period_days)
        readings = readings.filter(reading_at__gte=cutoff)
    readings = list(readings.order_by("reading_at", "created_at"))

    points = [
        {"date": r.reading_at.isoformat(), "quantity": float(r.quantity), "kind": r.kind}
        for r in readings
    ]
    last_level = float(item.quantity)

    rate_per_day: float | None = None
    projected_depletion_date: str | None = None

    if len(readings) >= 2:
        total_consumed = Decimal("0")
        for previous, current in zip(readings, readings[1:]):
            if current.quantity < previous.quantity:
                total_consumed += previous.quantity - current.quantity

        span_seconds = (readings[-1].reading_at - readings[0].reading_at).total_seconds()
        span_days = span_seconds / 86400 if span_seconds > 0 else 0

        if total_consumed > 0 and span_days > 0:
            rate = float(total_consumed) / span_days
            rate_per_day = round(rate, 3)
            if last_level > 0:
                days_left = last_level / rate
                projected_depletion_date = (
                    timezone.now() + timedelta(days=days_left)
                ).date().isoformat()

    return {
        "period": period,
        "points": points,
        "last_level": last_level,
        "points_count": len(readings),
        "rate_per_day": rate_per_day,
        "projected_depletion_date": projected_depletion_date,
    }
