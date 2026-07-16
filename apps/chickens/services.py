"""
Chicken coop services — single source of truth for writes and aggregates.

Both the REST viewsets and the agent's ``create_entity``/``update_entity``
writables call these functions, so validation (serializers), the status→event
side-effect and the egg-log upsert semantics live in exactly one place.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.translation import gettext as _

from .models import Chicken, ChickenEvent, ChickenSettings, EggLog
from .serializers import ChickenEventSerializer, ChickenSerializer, EggLogSerializer


# Status transitions that leave the flock auto-create a journal entry (US-2).
_STATUS_EVENT_TYPES = {
    Chicken.Status.DECEASED: ChickenEvent.Type.DEATH,
    Chicken.Status.GONE: ChickenEvent.Type.DEPARTURE,
}


def create_chicken(
    household,
    user,
    *,
    name: str,
    breed: str = '',
    color: str = '',
    hatched_on=None,
    acquired_on=None,
    status: str | None = None,
    notes: str = '',
    zone_id=None,
) -> Chicken:
    """Create a hen for ``household`` on behalf of ``user`` (REST + agent)."""
    payload: dict = {'name': name}
    if breed:
        payload['breed'] = breed
    if color:
        payload['color'] = color
    if hatched_on is not None:
        payload['hatched_on'] = hatched_on
    if acquired_on is not None:
        payload['acquired_on'] = acquired_on
    if status:
        payload['status'] = status
    if notes:
        payload['notes'] = notes
    if zone_id is not None:
        payload['zone_id'] = zone_id

    serializer = ChickenSerializer(data=payload, context={'household_id': household.id})
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


def update_chicken(household, user, chicken: Chicken, *, fields: dict) -> Chicken:
    """Update a hen — shared by the REST PATCH and the agent's ``update_entity``.

    A transition to DECEASED/GONE auto-creates the matching journal entry
    (dated today) so the flock history stays complete without extra input.
    """
    allowed = {'name', 'breed', 'color', 'hatched_on', 'acquired_on', 'status', 'notes', 'zone_id'}
    payload = {k: v for k, v in fields.items() if k in allowed}

    serializer = ChickenSerializer(
        chicken, data=payload, partial=True, context={'household_id': household.id}
    )
    serializer.is_valid(raise_exception=True)

    old_status = chicken.status
    with transaction.atomic():
        instance = serializer.save(updated_by=user)
        new_status = instance.status
        event_type = _STATUS_EVENT_TYPES.get(new_status)
        if event_type is not None and old_status != new_status:
            ChickenEvent.objects.create(
                household=household,
                created_by=user,
                chicken=instance,
                type=event_type,
                occurred_on=timezone.localdate(),
                title=_("{name} — status changed").format(name=instance.name),
            )
    return instance


def delete_chicken(household, user, chicken: Chicken) -> None:
    """Hard delete a hen (journal entries cascade) — REST DELETE and agent undo."""
    if chicken.household_id != household.id:
        raise ValueError("delete_chicken: chicken belongs to another household")
    chicken.delete()


def log_eggs(household, user, *, date, count, note: str = '') -> tuple[EggLog, bool]:
    """Upsert the daily egg count — one row per (household, date), never a duplicate.

    Returns ``(egg_log, created)``. Re-submitting the same day replaces the
    count (US-3), which is also what makes the agent's "j'ai ramassé 4 œufs"
    idempotent within a day.
    """
    serializer = EggLogSerializer(
        data={'date': date, 'count': count, 'note': note or ''},
        context={'household_id': household.id},
    )
    serializer.is_valid(raise_exception=True)
    validated = serializer.validated_data

    with transaction.atomic():
        egg_log, created = EggLog.objects.update_or_create(
            household=household,
            date=validated['date'],
            defaults={
                'count': validated['count'],
                'note': validated.get('note', ''),
                'updated_by': user,
            },
        )
        if created:
            egg_log.created_by = user
            egg_log.save(update_fields=['created_by'])
    return egg_log, created


def delete_egg_log(household, user, egg_log: EggLog) -> None:
    """Hard delete a daily egg log — REST DELETE and agent undo."""
    if egg_log.household_id != household.id:
        raise ValueError("delete_egg_log: log belongs to another household")
    egg_log.delete()


def create_event(
    household,
    user,
    *,
    type: str,
    title: str,
    occurred_on=None,
    chicken=None,
    notes: str = '',
    reminder_due_date=None,
) -> ChickenEvent:
    """Create a journal entry; optionally chain a care-reminder Task (US-6).

    The reminder goes through ``tasks.services.create_task`` (the tasks app's
    own service), so it behaves exactly like a task created from the UI.
    """
    payload: dict = {
        'type': type,
        'title': title,
        'occurred_on': occurred_on or timezone.localdate(),
    }
    if chicken is not None:
        payload['chicken'] = getattr(chicken, 'pk', chicken)
    if notes:
        payload['notes'] = notes

    serializer = ChickenEventSerializer(data=payload, context={'household_id': household.id})
    serializer.is_valid(raise_exception=True)

    with transaction.atomic():
        event = serializer.save(household=household, created_by=user)
        if reminder_due_date is not None:
            from tasks.services import create_task

            create_task(
                household,
                user,
                subject=event.title,
                content=event.notes,
                due_date=reminder_due_date,
            )
    return event


def delete_event(household, user, event: ChickenEvent) -> None:
    """Hard delete a journal entry — REST DELETE (undo is the deferred toast)."""
    if event.household_id != household.id:
        raise ValueError("delete_event: event belongs to another household")
    event.delete()


def get_settings(household) -> ChickenSettings:
    """Get-or-create the household's module settings row."""
    settings_obj, _created = ChickenSettings.objects.get_or_create(household=household)
    return settings_obj


# --- Aggregates ---------------------------------------------------------------


# Laying-curve periods offered by the UI (days). Anything else falls back to 30.
EGG_STATS_PERIODS = (7, 30, 90, 365)


def egg_stats(household, *, period: int = 30, today: date | None = None) -> dict:
    """Egg-laying stats + laying curve for a period (Lot 6.1).

    The pivot of this module: a day **without** an ``EggLog`` is *unknown*, never
    a zero. So the ``series`` carries ``count=null`` for unlogged days (the chart
    breaks the line there), and every average divides by the number of *logged*
    days — not calendar days. ``coverage`` exposes that honesty numerically
    (``logged_days`` / ``total_days``); the drop alert reuses the same idea as a
    guard against false positives.
    """
    today = today or timezone.localdate()
    if period not in EGG_STATS_PERIODS:
        period = 30
    start = today - timedelta(days=period - 1)
    start_30 = today - timedelta(days=29)
    start_7 = today - timedelta(days=6)
    month_start = today.replace(day=1)

    # One query wide enough for both the period window and the 7/30-day headers.
    window_start = min(start, start_30)
    logs = list(
        EggLog.objects.filter(household=household, date__gte=window_start, date__lte=today)
        .order_by('date')
        .values('date', 'count')
    )
    by_date = {row['date']: row['count'] for row in logs}

    def _avg(since: date) -> float | None:
        counts = [c for d, c in by_date.items() if d >= since]
        return round(sum(counts) / len(counts), 2) if counts else None

    series = [
        {
            'date': (start + timedelta(days=i)).isoformat(),
            'count': by_date.get(start + timedelta(days=i)),
        }
        for i in range(period)
    ]
    period_counts = [c for d, c in by_date.items() if start <= d <= today]
    logged_days = len(period_counts)
    period_total = sum(period_counts)
    best = max(
        ((d, c) for d, c in by_date.items() if start <= d <= today),
        key=lambda pair: pair[1],
        default=None,
    )

    month_total = (
        EggLog.objects.filter(household=household, date__gte=month_start, date__lte=today)
        .aggregate(total=Sum('count'))['total']
    )
    total_all = EggLog.objects.filter(household=household).aggregate(
        total=Sum('count')
    )['total']

    return {
        'period': period,
        'today': by_date.get(today),
        'avg_7d': _avg(start_7),
        'avg_30d': _avg(start_30),
        'month_total': month_total or 0,
        'total': total_all or 0,
        'period_total': period_total,
        'period_avg': round(period_total / logged_days, 2) if logged_days else None,
        'best_day': {'date': best[0].isoformat(), 'count': best[1]} if best else None,
        'coverage': {
            'logged_days': logged_days,
            'total_days': period,
            'rate': round(logged_days / period, 3) if period else 0,
        },
        'series': series,
    }


def _cost_totals(household, *, today: date, feed_stock_item=None) -> dict:
    """Cumulated flock expenses + cost per egg, with a feed/flock breakdown.

    Product decision (Lot 6.2): cost per egg = **feed + care**, durable gear
    excluded. That maps onto the existing data with no new field:

    - **feed** = purchases of the linked feed StockItem
      (``kind='stock_purchase'`` whose polymorphic source is that item);
    - **flock** = per-hen purchases (``kind='chickens_purchase'`` — vet, wormer,
      hen acquisition).

    Durable gear (feeder, coop) lives in its own module, is never a
    ``chickens_purchase``, and is therefore naturally out. The breakdown
    (``feed_total`` / ``flock_total``) is returned so the UI can show what counts.
    Accepted limit: re-linking to another feed item stops attributing the old
    item's purchases.
    """
    from django.contrib.contenttypes.models import ContentType
    from django.db.models import Q

    from interactions.models import Interaction

    year_start = today.replace(month=1, day=1)
    total = Decimal('0')
    year = Decimal('0')
    feed_total = Decimal('0')
    flock_total = Decimal('0')
    kinds = Q(metadata__kind='chickens_purchase')
    feed_ct = None
    if feed_stock_item is not None:
        feed_ct = ContentType.objects.get_for_model(type(feed_stock_item))
        kinds |= Q(
            metadata__kind='stock_purchase',
            source_content_type=feed_ct,
            source_object_id=feed_stock_item.pk,
        )
    qs = Interaction.objects.filter(
        kinds, household=household, type='expense'
    ).values('occurred_at', 'metadata', 'source_content_type_id', 'source_object_id')
    feed_ct_id = feed_ct.id if feed_ct is not None else None
    for row in qs:
        raw = (row['metadata'] or {}).get('amount')
        if raw in (None, ''):
            continue
        try:
            amount = Decimal(str(raw))
        except (InvalidOperation, ValueError):
            continue
        total += amount
        if (
            feed_ct_id is not None
            and row['source_content_type_id'] == feed_ct_id
            and str(row['source_object_id']) == str(feed_stock_item.pk)
        ):
            feed_total += amount
        else:
            flock_total += amount
        occurred = row['occurred_at']
        if occurred is not None and occurred.date() >= year_start:
            year += amount

    eggs_total = EggLog.objects.filter(household=household).aggregate(t=Sum('count'))['t'] or 0
    per_egg = (
        (total / eggs_total).quantize(Decimal('0.01'))
        if eggs_total and total > 0
        else None
    )
    return {
        'total': str(total),
        'year': str(year),
        'feed_total': str(feed_total),
        'flock_total': str(flock_total),
        'per_egg': str(per_egg) if per_egg is not None else None,
        'eggs_total': eggs_total,
    }


def flock_summary(household, *, today: date | None = None) -> dict:
    """Everything the dashboard widget and the page header need in one call."""
    today = today or timezone.localdate()
    start_7 = today - timedelta(days=6)

    active_count = Chicken.objects.filter(
        household=household, status__in=Chicken.FLOCK_STATUSES
    ).count()
    eggs_today = (
        EggLog.objects.filter(household=household, date=today)
        .values_list('count', flat=True)
        .first()
    )
    eggs_7d = (
        EggLog.objects.filter(household=household, date__gte=start_7, date__lte=today)
        .aggregate(t=Sum('count'))['t']
    )

    settings_obj = ChickenSettings.objects.filter(household=household).select_related(
        'feed_stock_item'
    ).first()
    feed = None
    item = settings_obj.feed_stock_item if settings_obj else None
    if item is not None:
        feed = {
            'stock_item_id': str(item.id),
            'name': item.name,
            'quantity': str(item.quantity),
            'unit': item.unit,
            'status': item.status,
            'min_quantity': str(item.min_quantity) if item.min_quantity is not None else None,
        }

    has_data = active_count > 0 or EggLog.objects.filter(household=household).exists()

    return {
        'active_count': active_count,
        'eggs_today': eggs_today,
        'eggs_7d': eggs_7d or 0,
        'feed': feed,
        'cost': _cost_totals(household, today=today, feed_stock_item=item),
        'has_data': has_data,
    }


def chicken_tab_counts(chicken: Chicken) -> dict[str, int]:
    """Number of items behind each tab of the chicken detail page.

    Consumed by ``ChickenSerializer`` (detail only) so the frontend can hide
    empty tabs. A couple of aggregate queries — fine for a single object, NOT
    on a list (would N+1). Mirrors ``projects.services.project_tab_counts``.
    """
    from django.contrib.contenttypes.models import ContentType

    from documents.models import DocumentLink

    chicken_ct = ContentType.objects.get_for_model(Chicken)
    links = DocumentLink.objects.filter(content_type=chicken_ct, object_id=chicken.id)

    return {
        'events': ChickenEvent.objects.filter(chicken=chicken).count(),
        'documents': links.exclude(document__type='photo').count(),
        'photos': links.filter(document__type='photo').count(),
    }
