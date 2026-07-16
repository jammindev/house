"""
``PingSpec`` entry point for the daily digest.

Registered from ``agent.apps.ready``. Reuses the whole pings machinery (opt-in
preference, local send time, idempotent tick, timezone + language, Telegram
delivery); this callback only builds the message. Returning ``None`` when the
digest is empty means the tick skips silently — no "nothing to report" spam.
"""
from __future__ import annotations

import html
from datetime import date

from .polish import polish_digest
from .service import build_digest, render_telegram


def build_daily_digest_message(household, user, *, today: date) -> str | None:
    """Build the digest text for the scheduled Telegram push (or ``None``)."""
    disabled = list(getattr(user, "digest_disabled_sections", None) or [])
    result = build_digest(household, user, today=today, disabled_sections=disabled)
    if result.is_empty:
        return None

    polished = polish_digest(result)
    if polished:
        # Polished text is plain — escape it for Telegram's HTML parse mode.
        return html.escape(polished)
    return render_telegram(result)
