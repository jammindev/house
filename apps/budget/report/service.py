"""
Monthly budget report service — generation + rendering.

- ``get_or_generate_report`` freezes the month's numeric snapshot once (idempotent
  per household+month).
- ``render_report`` turns a snapshot into prose in the active language: the
  deterministic template always, optionally rewritten by the LLM (memoized per
  language inside ``stats['_polished']`` so at most one call per month+language).
- ``last_closed_month`` is the previous calendar month in the household timezone.

Mirrors the digest's compose-in-the-recipient-language philosophy while keeping
history via the persisted snapshot.
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from django.db import IntegrityError
from django.utils import timezone, translation

from ..models import BudgetReport
from .polish import polish_report
from .render import render_text
from .stats import compute_month_stats, previous_month


def last_closed_month(household) -> str:
    """Return the previous calendar month (``YYYY-MM``) in the household tz."""
    try:
        tz = ZoneInfo(getattr(household, "timezone", "") or "UTC")
    except Exception:  # pragma: no cover
        tz = ZoneInfo("UTC")
    now = timezone.now().astimezone(tz)
    return previous_month(f"{now.year:04d}-{now.month:02d}")


def get_or_generate_report(household, month: str) -> BudgetReport:
    """Return the report for ``month``, computing + persisting it once.

    Idempotent: a concurrent create collides on the unique constraint and we
    re-fetch. The snapshot is frozen on first generation and never recomputed.
    """
    existing = BudgetReport.objects.filter(household_id=household.id, month=month).first()
    if existing is not None:
        return existing

    stats = compute_month_stats(household, month)
    try:
        return BudgetReport.objects.create(household=household, month=month, stats=stats)
    except IntegrityError:
        return BudgetReport.objects.get(household_id=household.id, month=month)


def render_report(report: BudgetReport, *, lang: str | None = None, polish: bool = True) -> str:
    """Render ``report`` as prose in ``lang`` (defaults to the active language).

    Deterministic template first; if polish is enabled and succeeds, the warmer
    LLM paragraph is used and cached under ``stats['_polished'][lang]`` so the
    next read in that language is free.
    """
    lang = lang or translation.get_language() or "en"
    with translation.override(lang):
        cache = (report.stats or {}).get("_polished", {})
        if polish and lang in cache:
            return cache[lang]

        deterministic = render_text(report.stats or {})
        if not polish:
            return deterministic

        polished = polish_report(deterministic)
        if polished:
            stats = dict(report.stats or {})
            polished_cache = dict(stats.get("_polished") or {})  # avoid aliasing live nested dict
            polished_cache[lang] = polished
            stats["_polished"] = polished_cache
            report.stats = stats
            report.save(update_fields=["stats", "updated_at"])
            return polished
        return deterministic
