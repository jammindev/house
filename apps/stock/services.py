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

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.timezones import household_today, household_tz
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

# Taille d'une barre du graphe de consommation. Un jour se lit sur un ou trois
# mois ; sur un an il faudrait 365 barres pour dire ce que douze disent mieux.
CONSUMPTION_GRANULARITY: dict[str, str] = {
    "30d": "day",
    "90d": "day",
    "1y": "month",
    "all": "month",
}


def recompute_status(item: StockItem) -> None:
    """Recompute ``item.status`` in place — the status is fully derived.

    There are no manual states: the status is a pure function of the quantity and
    its minimum threshold. Out when empty, low when at/under the minimum, in stock
    otherwise. Callers never set ``status`` by hand.
    """
    if item.quantity <= 0:
        item.status = StockItem.Status.OUT_OF_STOCK
    elif item.min_quantity is not None and item.quantity <= item.min_quantity:
        item.status = StockItem.Status.LOW_STOCK
    else:
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
    remaining_at: datetime | None = None,
    occurred_at: datetime | None = None,
    notes: str = "",
    budget_id=None,
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
    the restock jump. That count is dated ``remaining_at`` when given (an
    imported statement antedates the expense, but the count has its own day),
    otherwise ``occurred_at``. A count *after* the purchase is refused upstream
    by the serializer: it would leave the last reading below the item quantity.

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
            reading_at=remaining_at or occurred_at,
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
        budget_id=budget_id,
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


def _realign_item(item: StockItem, user) -> StockItem:
    """Ramener la quantité de l'article sur sa dernière lecture.

    L'invariant du module (« la lecture la plus récente coïncide avec
    ``StockItem.quantity`` ») ne tenait que parce que rien ne pouvait corriger une
    lecture. Dès qu'on en édite ou qu'on en supprime une, il faut le rétablir —
    sinon corriger un relevé fabrique exactement le désaccord que la courbe est
    censée montrer.

    Plus aucune lecture ⇒ **0**. Garder une quantité qu'aucune mesure n'atteste
    serait la valeur inventée que le projet refuse partout ailleurs ; l'article
    redevient ce qu'est un article créé vide.
    """
    latest = item.level_readings.order_by("-reading_at", "-created_at").first()
    old_status = item.status
    item.quantity = latest.quantity if latest is not None else Decimal("0")
    recompute_status(item)
    item.updated_by = user
    item.save()
    notify_stock_status_change(item, old_status, item.status)
    return item


@transaction.atomic
def revise_reading(
    *,
    reading: StockLevelReading,
    user,
    quantity: Decimal | None = None,
    reading_at: datetime | None = None,
) -> StockLevelReading:
    """Corriger la quantité et/ou la date d'une lecture, puis réaligner l'article.

    Déplacer une lecture dans le temps peut la faire devenir (ou cesser d'être) la
    dernière : c'est pour ça que le réalignement suit toujours l'écriture, et ne
    se déduit pas de ce qui a été édité.
    """
    if quantity is not None:
        reading.quantity = Decimal(quantity)
    if reading_at is not None:
        reading.reading_at = reading_at
    reading.updated_by = user
    reading.save()

    _realign_item(reading.stock_item, user)
    return reading


@transaction.atomic
def delete_reading(*, reading: StockLevelReading, user) -> StockItem:
    """Supprimer une lecture et réaligner l'article sur celle qui reste.

    La dépense éventuellement liée (``source_interaction``) n'est pas touchée :
    supprimer une mesure de niveau n'efface pas l'argent dépensé. L'inverse — se
    défaire de la dépense *et* du mouvement — est le geste de ``undo_purchase``.
    """
    item = reading.stock_item
    reading.delete()
    return _realign_item(item, user)


def record_initial_level(*, item: StockItem, user, occurred_at: datetime | None = None) -> StockLevelReading | None:
    """Write the origin ``inventory`` reading for a freshly created item.

    Called from ``perform_create`` so an item created with an initial quantity
    has a starting point on its consumption curve and satisfies the invariant
    (last reading == quantity) from birth. No status recompute nor notification:
    the create form owns the item's initial status. Returns ``None`` for an empty
    item (nothing to plot yet).
    """
    if Decimal(item.quantity) <= 0:
        return None
    return _record_level(
        item,
        quantity=Decimal(item.quantity),
        kind=StockLevelReading.Kind.INVENTORY,
        reading_at=occurred_at or timezone.now(),
        user=user,
    )


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
            household_id=household.id, id=interaction_id, kind="stock_purchase"
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


def _daily_consumption(readings, tz) -> dict:
    """Spread each descent between two readings over the days it covers.

    A level reading says *how much is left*, never *when it was eaten*: between
    two counts, the only honest attribution is a uniform one — which is exactly
    the arithmetic the headline burn rate already uses (total consumed / days
    spanned). Deriving the bars from the same descents is what keeps the two
    numbers from contradicting each other on the same screen. Restock jumps
    upward are not negative consumption and are skipped.
    """
    daily: dict = defaultdict(Decimal)
    for previous, current in zip(readings, readings[1:]):
        if current.quantity >= previous.quantity:
            continue
        consumed = previous.quantity - current.quantity
        start = previous.reading_at.astimezone(tz).date()
        end = current.reading_at.astimezone(tz).date()
        days = (end - start).days
        if days <= 0:
            # Two readings the same day: nothing to spread over.
            daily[end] += consumed
            continue
        share = consumed / days
        for offset in range(1, days + 1):
            daily[start + timedelta(days=offset)] += share
    return daily


def _bucket_start(day: date, granularity: str) -> date:
    return day.replace(day=1) if granularity == "month" else day


def _next_bucket(day: date, granularity: str) -> date:
    if granularity == "month":
        return (day + timedelta(days=32)).replace(day=1)
    return day + timedelta(days=1)


def _consumption_buckets(daily: dict, *, granularity: str, tz, start: date, end: date) -> list[dict]:
    """Aggregate the daily consumption into the window's bars, zeros included.

    A missing bar and a bar at zero read very differently: the window is filled
    end to end so an empty stretch shows as an empty stretch, not as a gap the
    chart silently closes.
    """
    totals: dict = defaultdict(Decimal)
    for day, value in daily.items():
        if start <= day <= end:
            totals[_bucket_start(day, granularity)] += value

    buckets = []
    cursor = _bucket_start(start, granularity)
    while cursor <= end:
        buckets.append(
            {
                "ts": datetime.combine(cursor, time.min, tzinfo=tz).isoformat(),
                "consumed": float(round(totals.get(cursor, Decimal("0")), 3)),
            }
        )
        cursor = _next_bucket(cursor, granularity)
    return buckets


def compute_consumption(item: StockItem, *, period: str = "90d") -> dict:
    """Build the consumption curve of an item + derived depletion metrics.

    Returns the dated level points over the selected window, the consumption
    **bars** (per day, or per month over a year), a burn rate and a projected
    depletion date. The rate is derived from the *descents* between consecutive
    readings (restock jumps upward are excluded); the honest daily average is
    ``total consumed / calendar days spanned``. Both metrics are ``None`` when
    there are fewer than two readings to interpolate.

    The last reading *before* the window anchors the computation: without it a
    30-day window on a slow-moving item shows nothing while the item empties.
    It never enters ``points`` — the raw curve stays what the window contains.

    Shape::

        {
          "period": "90d",
          "granularity": "day" | "month",
          "points": [{"date": iso, "quantity": float, "kind": str}, ...],
          "buckets": [{"ts": iso datetime, "consumed": float}, ...],
          "last_level": float,
          "points_count": int,
          "rate_per_day": float | None,
          "projected_depletion_date": iso date | None,
        }
    """
    period_days = CONSUMPTION_PERIOD_DAYS.get(period, 90)
    granularity = CONSUMPTION_GRANULARITY.get(period, "day")
    tz = household_tz(item.household)

    stored = StockLevelReading.objects.filter(stock_item=item)
    cutoff = timezone.now() - timedelta(days=period_days) if period_days is not None else None
    in_window = list(
        (stored.filter(reading_at__gte=cutoff) if cutoff else stored).order_by("reading_at", "created_at")
    )
    anchor = (
        stored.filter(reading_at__lt=cutoff).order_by("-reading_at", "-created_at").first()
        if cutoff
        else None
    )
    readings = ([anchor] if anchor is not None else []) + in_window

    points = [
        {"date": r.reading_at.isoformat(), "quantity": float(r.quantity), "kind": r.kind}
        for r in in_window
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

    buckets: list[dict] = []
    if len(readings) >= 2:
        end = max(household_today(item.household), readings[-1].reading_at.astimezone(tz).date())
        start = (
            cutoff.astimezone(tz).date() if cutoff else readings[0].reading_at.astimezone(tz).date()
        )
        buckets = _consumption_buckets(
            _daily_consumption(readings, tz),
            granularity=granularity,
            tz=tz,
            start=min(start, end),
            end=end,
        )

    return {
        "period": period,
        "granularity": granularity,
        "points": points,
        "buckets": buckets,
        "last_level": last_level,
        "points_count": len(points),
        "rate_per_day": rate_per_day,
        "projected_depletion_date": projected_depletion_date,
    }
