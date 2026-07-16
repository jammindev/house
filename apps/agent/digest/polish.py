"""
Optional LLM polish for the digest — strictly off the critical path.

When ``DIGEST_AI_POLISH_ENABLED`` is on and an API key is configured, the plain
digest is rewritten into a short, warm paragraph in the recipient's language.
Any problem (no key, no SDK, network error, empty reply) falls back to ``None``
so the caller ships the deterministic template instead. Mirrors the resilient
fallback of ``releases.services.polish_descriptions``.

The polished text is treated as plain text (the caller escapes it before it
reaches Telegram's HTML parser), so the model can never inject markup.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.utils import translation

from .service import DigestResult

logger = logging.getLogger(__name__)

_POLISH_SYSTEM = (
    "You rewrite a household's daily digest into a short, warm, natural message. "
    "Keep every fact exactly — never invent, drop or reorder information. "
    "2 to 4 short sentences, friendly but concise, no markdown, no headings, "
    "no bullet characters. Reply in the SAME language as the input, with the "
    "message text only — no preamble."
)


def _plain(result: DigestResult) -> str:
    """Flatten the digest into plain text for the model prompt."""
    blocks = []
    for section in result.sections:
        body = "\n".join(f"- {line}" for line in section.lines)
        blocks.append(f"{section.title}\n{body}")
    return "\n\n".join(blocks)


def polish_digest(result: DigestResult) -> str | None:
    """Return a polished plain-text digest, or ``None`` to use the template.

    Called inside the recipient's language context; the current language is
    passed to the model as a hint.
    """
    if result.is_empty:
        return None
    if not getattr(settings, "DIGEST_AI_POLISH_ENABLED", False):
        return None

    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        return None

    try:
        import anthropic
    except ImportError:
        logger.warning("digest: anthropic SDK absent — template fallback")
        return None

    lang = translation.get_language() or "en"
    user_msg = (
        f"Language: {lang}\n\nRewrite this daily digest into a short friendly "
        f"message, keeping every fact:\n\n{_plain(result)}"
    )
    try:
        client = anthropic.Anthropic(
            api_key=api_key,
            timeout=float(getattr(settings, "LLM_REQUEST_TIMEOUT_SECONDS", 30)),
        )
        message = client.messages.create(
            model=getattr(settings, "LLM_TEXT_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=512,
            system=_POLISH_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        text = "".join(
            getattr(block, "text", "") for block in getattr(message, "content", [])
        ).strip()
        return text or None
    except Exception as exc:  # noqa: BLE001 — best-effort, never blocks the send
        logger.warning("digest: LLM polish failed (%s) — template fallback", exc)
        return None
