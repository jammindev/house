"""
Frost × flowering — the alert that justifies the module (parcours 30, lot 7).

A spring frost **on open blossom** destroys a whole year's crop in one night, and
it is the only accident a household can actually act on (fleece, watering) if it
is warned the day before.

Nothing about temperature is decided here: ``weather.alerts`` already computes
frost, with its thresholds and its window. This module only contributes the
crossing with what the household has **declared** about flowering.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def frost_alerts_for_orchard(household) -> list[dict]:
    """Frost days that fall inside a declared flowering window.

    Degrades silently and returns ``[]`` when the weather module is off, the
    household has no location, or no subject has a declared window — an alert
    that cannot be computed is not an error to show, it is simply nothing to say.

    ⚠️ An **empty** flowering window is « nobody filled it in », never « never
    flowers ». So a household with no declared window gets no alert *and* the
    screen offers to declare one (`TreeDetailPage`). Treating the two as the same
    would print a green tick over an orchard nobody is watching — the same defect
    the money compliance window had to undo.
    """
    from weather.alerts import KIND_FROST, evaluate_weather_alerts

    from .models import Tree

    watched = [
        tree
        for tree in Tree.objects.filter(
            household_id=household.id, status__in=Tree.LIVING_STATUSES
        ).select_related('zone')
        if tree.has_flowering_window
    ]
    if not watched:
        return []

    try:
        weather = evaluate_weather_alerts(household)
    except Exception:  # pragma: no cover — weather is best-effort by contract
        logger.warning("orchard: weather unavailable for frost alert", exc_info=True)
        return []

    alerts = []
    for entry in weather:
        if entry.get('kind') != KIND_FROST:
            continue
        month = _month_of(entry.get('date'))
        if month is None:
            continue
        concerned = [tree for tree in watched if _in_window(tree, month)]
        if not concerned:
            continue
        alerts.append(
            {
                'date': entry.get('date'),
                'value': entry.get('value'),
                'unit': entry.get('unit'),
                'severity': 'critical',
                'trees': [
                    {'id': str(tree.id), 'name': tree.name, 'zone': tree.zone.name}
                    for tree in concerned
                ],
            }
        )
    return alerts


def _month_of(raw) -> int | None:
    from datetime import date

    if raw is None:
        return None
    if hasattr(raw, 'month'):
        return raw.month
    try:
        return date.fromisoformat(str(raw)).month
    except ValueError:
        return None


def _in_window(tree, month: int) -> bool:
    """Flowering windows straddle the year too (a mimosa flowers Dec→Feb)."""
    start, end = tree.flowering_start_month, tree.flowering_end_month
    if start <= end:
        return start <= month <= end
    return month >= start or month <= end


def household_has_watched_subjects(household) -> bool:
    """Whether any living subject declares a flowering window.

    Lets the screen tell « personne ne surveille » apart from « rien à
    signaler » — a zero with two meanings is the bug parcours 26 paid for.
    """
    from .models import Tree

    return any(
        tree.has_flowering_window
        for tree in Tree.objects.filter(
            household_id=household.id, status__in=Tree.LIVING_STATUSES
        ).only('flowering_start_month', 'flowering_end_month')
    )
