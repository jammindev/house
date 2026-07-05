"""
Tracker services — single source of truth for tracker and entry writes.

Same contract as ``tasks/services.py``: the REST viewsets AND the agent's
``create_entity`` / ``update_entity`` tools go through these functions, so
validation lives in the serializers and the denormalized caches
(``last_value`` / ``last_entry_at`` / ``entries_summary``) stay consistent no
matter who writes. Never create or mutate a ``TrackerEntry`` outside of this
module: every entry write must refresh the tracker cache in the same
transaction.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import Tracker, TrackerEntry
from .serializers import TrackerEntrySerializer, TrackerSerializer

#: Number of entries rendered in the RAG summary.
SUMMARY_ENTRIES = 10


def create_tracker(
    household,
    user,
    *,
    name: str,
    unit: str | None = None,
    description: str | None = None,
    emoji: str | None = None,
    project=None,
    target_type: str | None = None,
    target_id=None,
) -> Tracker:
    """Create a tracker for ``household`` on behalf of ``user``.

    Reuses ``TrackerSerializer`` so validation (project/target household scope,
    target resolution through the searchables registry) stays in one place.
    """
    payload: dict = {'name': name}
    if unit:
        payload['unit'] = unit
    if description:
        payload['description'] = description
    if emoji:
        payload['emoji'] = emoji
    if project is not None:
        payload['project'] = getattr(project, 'pk', project)
    if target_type and target_id:
        payload['target_type'] = target_type
        payload['target_id'] = str(target_id)

    serializer = TrackerSerializer(data=payload, context={'household_id': household.id})
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


def update_tracker(household, user, tracker: Tracker, *, fields: dict) -> Tracker:
    """Update ``tracker`` on behalf of ``user`` — shared by the agent's ``update_entity``."""
    allowed = {
        'name', 'unit', 'description', 'emoji', 'is_active',
        'project', 'target_type', 'target_id',
    }
    payload = {k: v for k, v in fields.items() if k in allowed}

    serializer = TrackerSerializer(
        tracker, data=payload, partial=True, context={'household_id': household.id}
    )
    serializer.is_valid(raise_exception=True)
    return serializer.save(updated_by=user)


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
    recomputed from the DB by ``occurred_at``, not by insertion order.
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
        refresh_tracker_cache(tracker)
    return entry


def update_entry(household, user, entry: TrackerEntry, *, fields: dict) -> TrackerEntry:
    """Update an entry (value, occurred_at, note) and refresh the tracker cache."""
    allowed = {'value', 'occurred_at', 'note'}
    payload = {k: v for k, v in fields.items() if k in allowed}

    serializer = TrackerEntrySerializer(
        entry, data=payload, partial=True, context={'household_id': household.id}
    )
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        entry = serializer.save(updated_by=user)
        refresh_tracker_cache(entry.tracker)
    return entry


def delete_entry(household, user, entry: TrackerEntry) -> None:
    """Hard-delete an entry (a wrong reading must disappear) and refresh the cache."""
    tracker = entry.tracker
    with transaction.atomic():
        entry.delete()
        refresh_tracker_cache(tracker)


def refresh_tracker_cache(tracker: Tracker) -> None:
    """Recompute ``last_value`` / ``last_entry_at`` / ``entries_summary`` from the DB.

    Always recomputed, never incremented — the latest entry is the max
    ``occurred_at`` (backdated writes included), not the last inserted row.
    """
    latest = tracker.entries.order_by('-occurred_at', '-created_at').first()
    tracker.last_value = latest.value if latest else None
    tracker.last_entry_at = latest.occurred_at if latest else None
    tracker.entries_summary = build_entries_summary(tracker)
    tracker.save(
        update_fields=['last_value', 'last_entry_at', 'entries_summary', 'updated_at']
    )


def build_entries_summary(tracker: Tracker) -> str:
    """Render the latest entries as compact text — the agent's view of the values.

    One line per entry (newest first) with the delta vs the previous entry, so
    the agent can answer "how much since last month" through plain retrieval.
    """
    entries = list(
        tracker.entries.order_by('-occurred_at', '-created_at')[: SUMMARY_ENTRIES + 1]
    )
    if not entries:
        return ''

    unit = f" {tracker.unit}" if tracker.unit else ''
    latest = entries[0]
    lines = [
        f"Unit: {tracker.unit or '-'} — latest: {_fmt(latest.value)}{unit} "
        f"({latest.occurred_at:%Y-%m-%d})"
    ]
    for i, entry in enumerate(entries[:SUMMARY_ENTRIES]):
        previous = entries[i + 1] if i + 1 < len(entries) else None
        delta = ''
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
