"""
Deterministic, localized rendering of a recap snapshot (parcours 27 lot 2).

Turns the language-agnostic ``stats`` into story cards in the active language via
``gettext``. This is the **always-available fallback**: it calls nothing, cannot
fail, and exists in all four languages. It is also the base the optional LLM
polish rewrites (captions only — never a figure).

Two invariants that must hold forever, because a frozen snapshot is a public
format written by possibly-older code:

- an **unknown card kind is skipped silently**, never an exception;
- a **missing key degrades**, never raises.

A rendered card is ``{kind, emoji, headline, value, value_type, caption}``.
``value_type`` tells the client how to display ``value``: ``money`` values stay raw
so the front formats them with ``formatAmount`` (project rule: one formatter), while
``count``/``raw`` values are shown as-is.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from django.utils.translation import gettext as _
from django.utils.translation import ngettext


def _amount(value: Any) -> str:
    """Normalize a snapshot amount to a plain decimal string for the client."""
    try:
        return f"{Decimal(str(value)):.2f}"
    except (InvalidOperation, TypeError, ValueError):
        return "0.00"


def _card(kind: str, emoji: str, headline: str, value: str, value_type: str, caption: str) -> dict[str, Any]:
    return {
        "kind": kind,
        "emoji": emoji,
        "headline": headline,
        "value": value,
        "value_type": value_type,
        "caption": caption,
    }


# --- Money --------------------------------------------------------------------


def _render_total_spent(data: dict[str, Any]) -> dict[str, Any] | None:
    count = int(data.get("expense_count") or 0)
    trend = data.get("trend_pct")

    if trend is None:
        caption = ngettext(
            "Across %(count)d expense.", "Across %(count)d expenses.", count
        ) % {"count": count}
    elif trend > 0:
        caption = _("That's %(pct)s%% more than the month before.") % {"pct": abs(trend)}
    elif trend < 0:
        caption = _("That's %(pct)s%% less than the month before.") % {"pct": abs(trend)}
    else:
        caption = _("Exactly as much as the month before.")

    return _card(
        "total_spent", "💰", _("spent"), _amount(data.get("value")), "money", caption
    )


def _render_budget_outcome(data: dict[str, Any]) -> dict[str, Any] | None:
    total = int(data.get("total") or 0)
    if not total:
        return None
    kept = int(data.get("kept") or 0)
    over_names = [n for n in (data.get("over_names") or []) if n]
    uncapped = int(data.get("uncapped_count") or 0)

    if over_names:
        caption = _("Over budget: %(names)s.") % {"names": ", ".join(over_names)}
    elif uncapped and not kept:
        # Nothing to keep or exceed — saying "all held" would be a green tick on
        # something that was never measured.
        caption = _("None of your categories has a ceiling yet.")
    else:
        caption = _("Every capped category held.")

    return _card(
        "budget_outcome",
        "🎯",
        _("budgets held"),
        f"{kept}/{total - uncapped}" if total - uncapped else f"{kept}/{total}",
        "raw",
        caption,
    )


def _render_biggest_expense(data: dict[str, Any]) -> dict[str, Any] | None:
    subject = (data.get("subject") or "").strip()
    if not subject:
        return None
    return _card(
        "biggest_expense",
        "🧾",
        subject,
        _amount(data.get("value")),
        "money",
        _("Your biggest expense of the month."),
    )


# --- What we got done ---------------------------------------------------------


def _render_tasks_done(data: dict[str, Any]) -> dict[str, Any] | None:
    count = int(data.get("count") or 0)
    if not count:
        return None
    return _card(
        "tasks_done",
        "✅",
        _("tasks finished"),
        str(count),
        "count",
        # "You", never "you more than them": a household figure is collective.
        ngettext(
            "Your household ticked one thing off.",
            "That's everything your household ticked off.",
            count,
        ),
    )


def _render_project_progress(data: dict[str, Any]) -> dict[str, Any] | None:
    name = (data.get("name") or "").strip()
    count = int(data.get("count") or 0)
    if not name or not count:
        return None
    return _card(
        "project_progress",
        "🔨",
        name,
        ngettext("%(count)d task", "%(count)d tasks", count) % {"count": count},
        "raw",
        _("The project that moved most this month."),
    )


# --- The house ----------------------------------------------------------------


def _render_eggs(data: dict[str, Any]) -> dict[str, Any] | None:
    total = int(data.get("value") or 0)
    if not total:
        return None
    logged = int(data.get("logged_days") or 0)
    best = data.get("best_day")

    if best:
        caption = _("Best day: %(best)d eggs.") % {"best": int(best)}
    else:
        # A day without a log is *unknown*, not a zero — so we say what the total
        # actually covers instead of implying a full month.
        caption = ngettext(
            "Logged on %(days)d day.", "Logged across %(days)d days.", logged
        ) % {"days": logged}

    return _card("eggs", "🥚", _("eggs laid"), str(total), "count", caption)


def _render_electricity(data: dict[str, Any]) -> dict[str, Any] | None:
    wh = int(data.get("wh") or 0)
    if wh <= 0:
        return None
    kwh = round(wh / 1000, 1)
    return _card(
        "electricity",
        "⚡",
        _("kWh used"),
        f"{kwh:g}",
        "count",
        _("Everything your meters recorded this month."),
    )


def _render_water(data: dict[str, Any]) -> dict[str, Any] | None:
    litres = int(data.get("litres") or 0)
    if litres <= 0:
        return None
    m3 = round(litres / 1000, 1)
    return _card(
        "water",
        "💧",
        _("m³ of water"),
        f"{m3:g}",
        "count",
        _("Roughly what the house drank this month."),
    )


# --- Memories -----------------------------------------------------------------


def _render_photos(data: dict[str, Any]) -> dict[str, Any] | None:
    count = int(data.get("count") or 0)
    if not count:
        return None
    return _card(
        "photos",
        "📸",
        ngettext("photo added", "photos added", count),
        str(count),
        "count",
        _("A month of your house, kept."),
    )


# --- Registry -----------------------------------------------------------------

#: One renderer per card kind. A kind absent from this map is skipped silently —
#: that is what lets a snapshot written by older code keep rendering forever.
CARD_RENDERERS: dict[str, Any] = {
    "total_spent": _render_total_spent,
    "budget_outcome": _render_budget_outcome,
    "biggest_expense": _render_biggest_expense,
    "tasks_done": _render_tasks_done,
    "project_progress": _render_project_progress,
    "eggs": _render_eggs,
    "electricity": _render_electricity,
    "water": _render_water,
    "photos": _render_photos,
}

#: Chapter emoji, keyed by chapter key. An unknown chapter renders with a neutral
#: one and an empty title rather than disappearing — its cards are still worth
#: showing, even when this version of the code has never heard of the chapter.
CHAPTER_EMOJI: dict[str, str] = {
    "money": "💰",
    "achievements": "✅",
    "home": "🏡",
    "memories": "📸",
}


def chapter_title(key: str) -> str:
    titles = {
        "money": _("Money"),
        "achievements": _("What you got done"),
        "home": _("The house"),
        "memories": _("Memories"),
    }
    return titles.get(key, "")


def render_card(card: dict[str, Any]) -> dict[str, Any] | None:
    """Render one snapshot card, or ``None`` when it cannot be told."""
    if not isinstance(card, dict):
        return None
    renderer = CARD_RENDERERS.get(card.get("kind") or "")
    if renderer is None:
        return None
    try:
        return renderer(card)
    except Exception:  # noqa: BLE001 — a malformed card is skipped, never fatal
        return None


def render_chapters(stats: dict[str, Any]) -> list[dict[str, Any]]:
    """Render the snapshot as localized chapters, dropping what cannot be told."""
    out: list[dict[str, Any]] = []
    for chapter in (stats or {}).get("chapters") or []:
        if not isinstance(chapter, dict):
            continue
        key = chapter.get("key") or ""
        cards = [c for c in (render_card(c) for c in chapter.get("cards") or []) if c]
        if not cards:
            continue
        out.append(
            {
                "key": key,
                "emoji": CHAPTER_EMOJI.get(key, "✨"),
                "title": chapter_title(key),
                "cards": cards,
            }
        )
    return out
