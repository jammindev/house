"""
``PingSpec`` entry point for the monthly household recap (parcours 27 lot 6).

Registered from ``recap.apps.ready``. Reuses the pings machinery (opt-in, local send
time, idempotent tick, timezone + language, Telegram delivery). Fires only on the 1st.

**The ping is a teaser plus a link, never the recap itself.** A story is meant to be
*looked at*, one card per screen; flattened into a chat thread it becomes the grey
paragraph this whole parcours exists to replace.

Assumed consequence: a user who enabled both this and the monthly budget report gets
two messages on the 1st. Hence ``monthly_recap`` ships **off by default**, and the
settings page says so.
"""
from __future__ import annotations

import html
from datetime import date

from django.conf import settings
from django.utils.translation import gettext as _
from django.utils.translation import ngettext

from .service import get_or_generate_recap, last_closed_month, render_recap


def build_monthly_recap_message(household, user, *, today: date) -> str | None:
    """Build the recap teaser (or ``None`` when not the 1st / nothing to tell)."""
    if today.day != 1:
        return None

    month = last_closed_month(household)
    recap = get_or_generate_recap(household, month)

    # Below the threshold the snapshot still exists and stays browsable from the
    # history — but a monthly appointment that delivers nothing wears out the
    # appointment, so it does not knock on the door.
    if recap.card_count < int(getattr(settings, "RECAP_MIN_CARDS", 3)):
        return None

    # Deterministic captions for the teaser: an outbound message must not depend on
    # an LLM call succeeding, and the warm version is what the story itself shows.
    chapters = render_recap(
        recap,
        polish=False,
        disabled_chapters=getattr(user, "recap_disabled_chapters", None) or (),
    )
    cards = [card for chapter in chapters for card in chapter["cards"]]
    if not cards:
        return None  # the user muted every chapter — nothing to announce

    header = _("Your recap for %(month)s is ready.") % {"month": month}
    teaser = [f"• {card['value']} {card['headline']}" for card in cards[:2]]
    footer = ngettext(
        "%(count)d card is waiting for you:",
        "%(count)d cards are waiting for you:",
        len(cards),
    ) % {"count": len(cards)}

    return _render(header, teaser, footer, f"/app/recap/{month}")


def _render(header: str, teaser: list[str], footer: str, link: str) -> str:
    """Assemble the Telegram HTML: bold header, everything else escaped.

    Card headlines are localized strings and card values can carry user-authored
    text (a supplier name, a project title), so every line but the markup is
    escaped — a project called ``Cuisine <2026>`` must not break the message.
    """
    lines = [html.escape(line) for line in [*teaser, "", footer, link]]
    return f"<b>{html.escape(header)}</b>\n\n" + "\n".join(lines)
