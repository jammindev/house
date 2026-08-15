"""
Orchard read helpers — the **single** place harvests are aggregated.

Same rule as ``interactions.queries.expenses()``: one helper, so a total can
never acquire a second definition. Two screens that disagree on what a tree gave
make the household stop believing both.
"""
from __future__ import annotations

from django.db.models import Sum

from core.timezones import household_today

from .models import Harvest

#: How many seasons the series shows by default. Five is enough to read an
#: alternating producer — one season says nothing at all.
DEFAULT_SEASON_COUNT = 5


def harvest_totals(household, *, tree=None, season=None) -> list[dict]:
    """Total harvested, **grouped by unit** — never a single number.

    12 kg and 40 pieces do not add up. Returning one figure would mean picking a
    unit to lie in; returning the groups lets the screen say both.
    """
    qs = Harvest.objects.filter(household_id=household.id)
    if tree is not None:
        qs = qs.filter(tree_id=getattr(tree, 'pk', tree))
    if season is not None:
        qs = qs.filter(harvested_on__year=season)

    rows = qs.values('unit').annotate(quantity=Sum('quantity')).order_by('unit')
    return [{'unit': row['unit'], 'quantity': str(row['quantity'])} for row in rows]


def harvest_series(household, *, tree=None, seasons: int = DEFAULT_SEASON_COUNT) -> dict:
    """The last ``seasons`` seasons, most recent first, plus the current one.

    The current season is the household's calendar year — computed in **its**
    timezone, never the server's: a picking logged just before midnight on 31
    December would otherwise land in the wrong year, and a season boundary
    decides which total a kilo belongs to.
    """
    current = household_today(household).year

    qs = Harvest.objects.filter(household_id=household.id)
    if tree is not None:
        qs = qs.filter(tree_id=getattr(tree, 'pk', tree))

    # One GROUP BY for every (season, unit) pair, then folded in Python — the
    # table is small and this keeps the whole series to a single query.
    rows = (
        qs.values('harvested_on__year', 'unit')
        .annotate(quantity=Sum('quantity'))
        .order_by('-harvested_on__year', 'unit')
    )

    grouped: dict[int, list[dict]] = {}
    for row in rows:
        year = row['harvested_on__year']
        grouped.setdefault(year, []).append(
            {'unit': row['unit'], 'quantity': str(row['quantity'])}
        )

    ordered = sorted(grouped.keys(), reverse=True)[:seasons]
    return {
        'current_season': current,
        'seasons': [{'season': year, 'totals': grouped[year]} for year in ordered],
    }
