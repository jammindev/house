"""
Tracker services — single source of truth for tracker and entry writes.

Same contract as ``tasks/services.py``: the REST viewsets AND the agent's
``create_entity`` / ``update_entity`` tools go through these functions, so
validation lives in the serializers and the denormalized caches
(``last_value`` / ``last_entry_at`` / ``rate_per_day`` / ``entries_summary``)
stay consistent no matter who writes. Never create or mutate a
``TrackerEntry`` outside of this module: every entry write must refresh the
tracker cache — and, for consumption trackers, adjust the reserve — in the
same transaction.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import Tracker, TrackerEntry
from .serializers import TrackerEntrySerializer, TrackerSerializer

#: Number of entries rendered in the RAG summary.
SUMMARY_ENTRIES = 10
#: Sliding window (days, by occurred_at) for the consumption rate.
RATE_WINDOW_DAYS = 14


def create_tracker(
    household,
    user,
    *,
    name: str,
    unit: str | None = None,
    description: str | None = None,
    emoji: str | None = None,
    kind: str | None = None,
    reserve=None,
    project=None,
    target_type: str | None = None,
    target_id=None,
) -> Tracker:
    """Create a tracker for ``household`` on behalf of ``user``.

    Reuses ``TrackerSerializer`` so validation (project/target household scope,
    target resolution through the searchables registry, kind choices) stays in
    one place.
    """
    payload: dict = {'name': name}
    if unit:
        payload['unit'] = unit
    if description:
        payload['description'] = description
    if emoji:
        payload['emoji'] = emoji
    if kind:
        payload['kind'] = kind
    if reserve is not None:
        payload['reserve'] = reserve
    if project is not None:
        payload['project'] = getattr(project, 'pk', project)
    if target_type and target_id:
        payload['target_type'] = target_type
        payload['target_id'] = str(target_id)

    serializer = TrackerSerializer(data=payload, context={'household_id': household.id})
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


def update_tracker(household, user, tracker: Tracker, *, fields: dict) -> Tracker:
    """Update ``tracker`` on behalf of ``user`` — shared by the agent's ``update_entity``.

    ``kind`` is immutable (rejected by the serializer); ``reserve`` is the
    refill path ("+1 bag" is sent as the new total).
    """
    allowed = {
        'name', 'unit', 'description', 'emoji', 'is_active', 'reserve',
        'project', 'target_type', 'target_id',
    }
    payload = {k: v for k, v in fields.items() if k in allowed}

    serializer = TrackerSerializer(
        tracker, data=payload, partial=True, context={'household_id': household.id}
    )
    serializer.is_valid(raise_exception=True)
    tracker = serializer.save(updated_by=user)
    if 'reserve' in payload:
        # The runway in the RAG summary depends on the reserve — keep it fresh.
        refresh_tracker_cache(tracker)
    return tracker


def add_entry(
    household,
    user,
    tracker: Tracker,
    *,
    value,
    occurred_at=None,
    note: str | None = None,
) -> TrackerEntry:
    """Add a dated value to ``tracker`` and refresh its cache atomically.

    ``occurred_at`` defaults to now; backdating is a normal case — the cache is
    recomputed from the DB by ``occurred_at``, not by insertion order. On a
    consumption tracker the entry is an amount consumed: the reserve is
    decremented in the same transaction (and re-credited if the entry is
    deleted, e.g. by an undo).
    """
    payload: dict = {
        'tracker': tracker.pk,
        'value': value,
        'occurred_at': occurred_at or timezone.now(),
    }
    if note:
        payload['note'] = note

    serializer = TrackerEntrySerializer(data=payload, context={'household_id': household.id})
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        entry = serializer.save(household=household, created_by=user)
        _adjust_reserve(tracker, -entry.value)
        refresh_tracker_cache(tracker)
    return entry


def update_entry(household, user, entry: TrackerEntry, *, fields: dict) -> TrackerEntry:
    """Update an entry (value, occurred_at, note) and refresh the tracker cache.

    On a consumption tracker, changing the value adjusts the reserve by the
    delta (the old amount is re-credited, the new one debited).
    """
    allowed = {'value', 'occurred_at', 'note'}
    payload = {k: v for k, v in fields.items() if k in allowed}
    old_value = entry.value

    serializer = TrackerEntrySerializer(
        entry, data=payload, partial=True, context={'household_id': household.id}
    )
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        entry = serializer.save(updated_by=user)
        _adjust_reserve(entry.tracker, old_value - entry.value)
        refresh_tracker_cache(entry.tracker)
    return entry


def delete_entry(household, user, entry: TrackerEntry) -> None:
    """Hard-delete an entry (a wrong reading must disappear) and refresh the cache.

    On a consumption tracker the reserve is re-credited — this is also the undo
    path for agent- and quick-add-created entries.
    """
    tracker = entry.tracker
    value = entry.value
    with transaction.atomic():
        entry.delete()
        _adjust_reserve(tracker, value)
        refresh_tracker_cache(tracker)


def _adjust_reserve(tracker: Tracker, delta: Decimal) -> None:
    """Shift a consumption tracker's reserve by ``delta`` (row-level, race-safe).

    No-op for measure trackers and for consumption trackers without a reserve.
    Never clamped: a negative reserve signals the gap instead of hiding it.
    """
    if tracker.kind != Tracker.Kind.CONSUMPTION or tracker.reserve is None:
        return
    Tracker.objects.filter(pk=tracker.pk).update(reserve=F('reserve') + delta)
    tracker.refresh_from_db(fields=['reserve'])


def refresh_tracker_cache(tracker: Tracker) -> None:
    """Recompute the cached fields from the DB.

    ``last_value`` / ``last_entry_at`` come from the entry with the max
    ``occurred_at`` (backdated writes included), never from insertion order.
    ``rate_per_day`` (consumption) uses the sliding window. Always recomputed,
    never incremented — except ``reserve``, an external fact adjusted by
    ``_adjust_reserve``.
    """
    latest = tracker.entries.order_by('-occurred_at', '-created_at').first()
    tracker.last_value = latest.value if latest else None
    tracker.last_entry_at = latest.occurred_at if latest else None
    tracker.rate_per_day = (
        compute_rate_per_day(tracker)
        if tracker.kind == Tracker.Kind.CONSUMPTION
        else None
    )
    tracker.entries_summary = build_entries_summary(tracker)
    tracker.save(
        update_fields=[
            'last_value', 'last_entry_at', 'rate_per_day', 'entries_summary', 'updated_at',
        ]
    )


def compute_rate_per_day(tracker: Tracker, now=None) -> Decimal | None:
    """Average consumption per day over the last ``RATE_WINDOW_DAYS`` days.

    Sum of the window's entries divided by the days actually covered (from the
    window's first entry to now, floored at 1 day so a couple of same-week
    entries already yield a usable rate). None when the window is empty.
    """
    now = now or timezone.now()
    window_start = now - timedelta(days=RATE_WINDOW_DAYS)
    entries = list(
        tracker.entries.filter(occurred_at__gte=window_start, occurred_at__lte=now)
        .order_by('occurred_at')
        .values_list('value', 'occurred_at')
    )
    if not entries:
        return None
    total = sum((value for value, _ in entries), Decimal('0'))
    first_at = entries[0][1]
    coverage_days = Decimal((now - first_at).total_seconds()) / Decimal(86400)
    coverage_days = max(coverage_days, Decimal(1))
    return (total / coverage_days).quantize(Decimal('0.001'))


def runway(tracker: Tracker) -> tuple[Decimal, timezone.datetime] | None:
    """(days left, estimated end date) from the reserve and the cached rate.

    None when the tracker is not a consumption one, has no reserve, no usable
    rate, or the reserve is already exhausted.
    """
    if (
        tracker.kind != Tracker.Kind.CONSUMPTION
        or tracker.reserve is None
        or not tracker.rate_per_day
        or tracker.rate_per_day <= 0
        or tracker.reserve < 0
    ):
        return None
    days = (tracker.reserve / tracker.rate_per_day).quantize(Decimal('0.1'))
    until = timezone.now() + timedelta(days=float(days))
    return days, until


def build_entries_summary(tracker: Tracker) -> str:
    """Render the latest entries as compact text — the agent's view of the values.

    Measure trackers: one line per entry (newest first) with the delta vs the
    previous entry. Consumption trackers: the header carries rate, reserve and
    runway — that is what answers "combien de temps je tiens ?" through plain
    retrieval — and lines are raw amounts (no deltas).
    """
    entries = list(
        tracker.entries.order_by('-occurred_at', '-created_at')[: SUMMARY_ENTRIES + 1]
    )
    if not entries:
        return ''

    unit = f" {tracker.unit}" if tracker.unit else ''
    is_consumption = tracker.kind == Tracker.Kind.CONSUMPTION

    if is_consumption:
        parts = []
        if tracker.rate_per_day:
            parts.append(f"Rate: ≈{_fmt(tracker.rate_per_day)}{unit}/day")
        if tracker.reserve is not None:
            parts.append(f"reserve: {_fmt(tracker.reserve)}{unit}")
        run = runway(tracker)
        if run is not None:
            days, until = run
            parts.append(f"runway: ~{_fmt(days)} days (until {until:%Y-%m-%d})")
        lines = [' — '.join(parts) if parts else f"Unit: {tracker.unit or '-'}"]
    else:
        latest = entries[0]
        lines = [
            f"Unit: {tracker.unit or '-'} — latest: {_fmt(latest.value)}{unit} "
            f"({latest.occurred_at:%Y-%m-%d})"
        ]

    for i, entry in enumerate(entries[:SUMMARY_ENTRIES]):
        delta = ''
        if not is_consumption:
            previous = entries[i + 1] if i + 1 < len(entries) else None
            if previous is not None:
                diff = entry.value - previous.value
                delta = f" ({'+' if diff >= 0 else ''}{_fmt(diff)})"
        note = f" — {entry.note}" if entry.note else ''
        lines.append(
            f"{entry.occurred_at:%Y-%m-%d %H:%M}: {_fmt(entry.value)}{unit}{delta}{note}"
        )
    return '\n'.join(lines)


def _fmt(value: Decimal) -> str:
    """Render a Decimal without trailing zeros (148.200 → 148.2, 3.000 → 3)."""
    text = f"{value:f}"
    return text.rstrip('0').rstrip('.') if '.' in text else text
