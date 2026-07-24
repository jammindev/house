"""
Optional LLM polish for the monthly budget report — off the critical path.

When ``BUDGET_REPORT_AI_POLISH_ENABLED`` is on and an API key is configured, the
factual line list is rewritten into a short, warm paragraph in the active
language. Any problem (no key, no SDK, network error, empty reply) returns
``None`` so the caller ships the deterministic text. Mirrors ``digest.polish``.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.utils import translation

logger = logging.getLogger(__name__)

_POLISH_SYSTEM = (
    "You rewrite a household's monthly budget report into a short, warm, natural "
    "message. Keep every figure exactly — never invent, drop or reorder numbers. "
    "3 to 5 short sentences, friendly but concise, no markdown, no headings, no "
    "bullet characters. Reply in the SAME language as the input, message text "
    "only — no preamble."
)


def polish_report(plain_text: str) -> str | None:
    """Return a polished plain-text report, or ``None`` to use the template."""
    if not plain_text.strip():
        return None
    if not getattr(settings, "BUDGET_REPORT_AI_POLISH_ENABLED", False):
        return None

    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        return None

    try:
        import anthropic
    except ImportError:
        logger.warning("budget report: anthropic SDK absent — template fallback")
        return None

    lang = translation.get_language() or "en"
    user_msg = (
        f"Language: {lang}\n\nRewrite this monthly budget report into a short "
        f"friendly message, keeping every figure:\n\n{plain_text}"
    )
    try:
        client = anthropic.Anthropic(
            api_key=api_key,
            timeout=float(getattr(settings, "LLM_REQUEST_TIMEOUT_SECONDS", 30)),
        )
        message = client.messages.create(
            model=getattr(settings, "LLM_TEXT_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=600,
            system=_POLISH_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        text = "".join(
            getattr(block, "text", "") for block in getattr(message, "content", [])
        ).strip()
        return text or None
    except Exception as exc:  # noqa: BLE001 — best-effort, never blocks
        logger.warning("budget report: LLM polish failed (%s) — template fallback", exc)
        return None
