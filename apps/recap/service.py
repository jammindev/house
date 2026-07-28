"""
Recap service — freeze the snapshot, render it later (parcours 27).

- ``get_or_generate_recap`` freezes one month's language-agnostic snapshot once
  (idempotent per household+month) and never recomputes an existing one.
- ``build_stats`` runs the active chapter collectors and isolates a failing one.
- ``last_closed_month`` is the previous calendar month in the household timezone.
- ``render_recap`` turns a snapshot into localized cards (see ``render.py``),
  optionally polished by the LLM and memoized per language.

Mirrors ``budget.report.service``; the shared concept is documented in
``docs/fiches/SNAPSHOT_ET_RECIT.md``.
"""
from __future__ import annotations

import logging
from typing import Any

from django.db import IntegrityError
from django.utils import translation

from budget.report.stats import month_bounds, previous_month
from core.timezones import household_today

from .chapters import active_chapter_specs
from .models import HouseholdRecap

logger = logging.getLogger(__name__)


def last_closed_month(household) -> str:
    """Return the previous calendar month (``YYYY-MM``) in the household tz."""
    today = household_today(household)
    return previous_month(f"{today.year:04d}-{today.month:02d}")


def build_stats(household, month: str) -> dict[str, Any]:
    """Compose the language-agnostic snapshot for ``household`` over ``month``.

    Month bounds are computed **once** here and handed to every collector, so the
    whole recap agrees on where the month starts and stops (``core.timezones`` via
    ``budget.report.stats.month_bounds``).

    A collector that raises is logged and dropped — it never sinks the rest of the
    recap. A chapter whose module is disabled is *absent*, not empty.
    """
    start, end = month_bounds(household, month)

    chapters: list[dict[str, Any]] = []
    for spec in active_chapter_specs(household):
        try:
            chapter = spec.collect(household, month, start=start, end=end)
        except Exception:  # noqa: BLE001 — isolate a broken collector
            logger.exception("recap: collector %s failed for %s", spec.key, month)
            continue
        if chapter and chapter.cards:
            chapters.append(chapter.as_dict())

    return {
        "month": month,
        "generated_for": [c["key"] for c in chapters],
        "chapters": chapters,
        "card_count": sum(len(c["cards"]) for c in chapters),
    }


def get_or_generate_recap(household, month: str) -> HouseholdRecap:
    """Return the recap for ``month``, computing + persisting it once.

    Idempotent: a concurrent create collides on the unique constraint and we
    re-fetch. The snapshot is frozen on first generation and never recomputed —
    a later edit to an expense or a task does not rewrite a closed month.
    """
    existing = HouseholdRecap.objects.filter(household_id=household.id, month=month).first()
    if existing is not None:
        return existing

    stats = build_stats(household, month)
    try:
        return HouseholdRecap.objects.create(household=household, month=month, stats=stats)
    except IntegrityError:
        return HouseholdRecap.objects.get(household_id=household.id, month=month)


def render_recap(
    recap: HouseholdRecap,
    *,
    lang: str | None = None,
    polish: bool = True,
    disabled_chapters=(),
) -> list[dict[str, Any]]:
    """Render ``recap`` as localized chapters in ``lang`` (defaults to active).

    ``disabled_chapters`` is a **read** preference: a chapter the user turned off
    disappears from the rendering but stays in the frozen snapshot.

    Deterministic template first; if polish is enabled and succeeds, the warmer
    captions are used and cached under ``stats['_polished'][lang]`` so the next
    read in that language is free.
    """
    from .polish import polish_captions
    from .render import render_chapters

    lang = lang or translation.get_language() or "en"
    disabled = frozenset(disabled_chapters or ())

    with translation.override(lang):
        chapters = render_chapters(recap.stats or {})
        chapters = [c for c in chapters if c["key"] not in disabled]
        if not polish or not chapters:
            return chapters

        cached = ((recap.stats or {}).get("_polished") or {}).get(lang)
        if cached is None:
            cached = polish_captions(chapters)
            if cached is not None:
                _store_polished(recap, lang, cached)
        return _apply_polished(chapters, cached) if cached else chapters


def _store_polished(recap: HouseholdRecap, lang: str, captions: dict[str, str]) -> None:
    """Memoize polished captions for ``lang`` — copying the nested dicts.

    Mutating the live nested dict in place would alias the instance's ``stats`` and
    silently skip the write (the trap already commented in
    ``budget/report/service.py``).
    """
    stats = dict(recap.stats or {})
    polished = dict(stats.get("_polished") or {})
    polished[lang] = captions
    stats["_polished"] = polished
    recap.stats = stats
    recap.save(update_fields=["stats", "updated_at"])


def _apply_polished(chapters: list[dict[str, Any]], captions: dict[str, str]) -> list[dict[str, Any]]:
    """Overlay memoized captions onto rendered cards, keyed by card kind.

    Only the ``caption`` is ever replaced — never a figure. A kind missing from the
    cache keeps its deterministic caption.
    """
    out = []
    for chapter in chapters:
        cards = []
        for card in chapter["cards"]:
            polished = captions.get(card["kind"]) if isinstance(captions, dict) else None
            cards.append({**card, "caption": polished} if polished else card)
        out.append({**chapter, "cards": cards})
    return out
