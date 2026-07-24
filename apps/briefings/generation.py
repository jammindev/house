"""Briefing content generation + manual delivery.

A briefing's content is produced by the **agent** itself: the user's free-text
``prompt`` is run through ``agent.service.ask`` so the message benefits from the
whole toolbox (household RAG, weather, web search) with zero briefing-specific
retrieval code. The answer is stripped of ``<cite/>`` markers and HTML-escaped
before it reaches Telegram (which parses HTML).

Two entry points, both reused later by the scheduled tick (lot 3):

- ``generate_briefing_text`` — one agent run, scoped to a recipient's
  permissions (private data filtering follows the user passed to ``ask``);
- ``send_briefing_now`` — generate per recipient and push via Telegram, with a
  ``{sent, skipped_no_telegram, errors, total_recipients}`` summary. Recipients
  are the creator (private) or every household member (shared); a member without
  a linked Telegram account is skipped, never an error.
"""
from __future__ import annotations

import html
import logging
import re

from django.utils import translation

logger = logging.getLogger(__name__)

# Strip the agent's citation markers (<cite id="…"/>) — meaningless in a pushed
# briefing. Both quote styles, self-closing or not (mirrors agent.service._CITE_RE).
_CITE_RE = re.compile(r"""<cite\s+[^>]*?/?>""", re.IGNORECASE)

# Frames the user's prompt so the model returns a ready-to-send message rather
# than a Q&A answer with citations/preamble.
_GEN_INSTRUCTION = (
    "You are composing a short, natural personal briefing that will be pushed to "
    "the user on Telegram. Reply with the message only — no preamble, no heading, "
    "no citations, no markdown. Answer in the user's language. Here is what the "
    "user wants in this briefing:\n\n"
)


def generate_briefing_text(briefing, *, recipient) -> str:
    """Generate the briefing message for ``recipient`` (one agent run).

    Runs inside the recipient's language so any localized tool output aligns.
    Never raises for an empty/IDK answer — returns whatever the agent produced
    (possibly the agent's own "nothing found" message). LLM transport errors
    (timeout, API) propagate so the caller can surface them.
    """
    from agent.service import ask

    with translation.override(_recipient_language(recipient, briefing.household)):
        result = ask(
            _GEN_INSTRUCTION + briefing.prompt,
            briefing.household,
            user=recipient,
        )
    return _cleanup(_CITE_RE.sub("", result.answer or ""))


def send_briefing_now(briefing, *, triggered_by) -> dict:
    """Generate + push the briefing to its recipients right now (manual trigger).

    Per-recipient generation keeps each message scoped to that user's
    permissions. Fault-isolated: one recipient failing (LLM or Telegram) never
    blocks the others. Returns a summary for the caller's toast.
    """
    from telegram.models import TelegramAccount
    from telegram.outbound import send_agent_message

    recipients = _recipients(briefing)
    sent = skipped_no_telegram = errors = 0

    for user in recipients:
        account = TelegramAccount.objects.filter(user=user).first()
        if account is None:
            skipped_no_telegram += 1
            continue
        try:
            with translation.override(_recipient_language(user, briefing.household)):
                text = generate_briefing_text(briefing, recipient=user)
                payload = _render_telegram(briefing, text)
            if send_agent_message(account, briefing.household, payload):
                sent += 1
            else:
                errors += 1
        except Exception:  # noqa: BLE001 — isolate failures per recipient
            errors += 1
            logger.exception(
                "briefings.send_now failed for briefing=%s user=%s",
                briefing.pk,
                user.pk,
            )

    return {
        "total_recipients": len(recipients),
        "sent": sent,
        "skipped_no_telegram": skipped_no_telegram,
        "errors": errors,
    }


def _recipients(briefing) -> list:
    """Users who should receive this briefing: creator (private) or all members."""
    if briefing.is_private:
        return [briefing.created_by] if briefing.created_by_id else []

    from households.models import HouseholdMember

    members = HouseholdMember.objects.filter(
        household_id=briefing.household_id
    ).select_related("user")
    return [m.user for m in members if m.user_id]


def _render_telegram(briefing, text: str) -> str:
    """Bold title + escaped body — safe for Telegram's HTML parser."""
    title = html.escape(briefing.title)
    body = html.escape(text)
    return f"<b>{title}</b>\n\n{body}"


def _recipient_language(user, household) -> str:
    """User locale, falling back to the household language (same as pings)."""
    if getattr(user, "locale", None):
        return user.locale
    return household.preferred_language or "en"


def _cleanup(text: str) -> str:
    """Trim and collapse whitespace left by stripped markers."""
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
