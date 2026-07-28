"""
Optional LLM polish for the recap captions — off the critical path.

When ``RECAP_AI_POLISH_ENABLED`` is on and an API key is configured, the factual
captions are rewritten into warmer one-liners in the active language. **Only the
captions**: headlines and figures are never handed over, so the model has no way to
alter a number.

Any problem (no key, no SDK, network error, bad JSON, missing kind) returns ``None``
so the caller ships the deterministic text. Mirrors ``budget.report.polish`` and
``releases.polish_descriptions``: the template always leaves, the AI is a varnish
that can never block a monthly appointment.
"""
from __future__ import annotations

import json
import logging

from django.conf import settings
from django.utils import translation

logger = logging.getLogger(__name__)

_POLISH_SYSTEM = (
    "You rewrite the captions of a household's monthly recap into warm, natural "
    "one-liners. You receive a JSON object mapping card keys to captions. Reply with "
    "ONLY a JSON object using the EXACT same keys, each value a single short "
    "sentence in the SAME language as the input. Keep every figure exactly as given "
    "— never invent, drop or change a number. No markdown, no preamble, no extra keys."
)

_MAX_CAPTIONS = 24


def polish_captions(chapters: list[dict]) -> dict[str, str] | None:
    """Return ``{card_kind: warmer_caption}``, or ``None`` to keep the template."""
    source = {
        card["kind"]: card["caption"]
        for chapter in chapters or []
        for card in chapter.get("cards") or []
        if card.get("kind") and card.get("caption")
    }
    if not source or len(source) > _MAX_CAPTIONS:
        return None
    if not getattr(settings, "RECAP_AI_POLISH_ENABLED", False):
        return None

    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        return None

    try:
        import anthropic
    except ImportError:
        logger.warning("recap: anthropic SDK absent — template fallback")
        return None

    lang = translation.get_language() or "en"
    user_msg = (
        f"Language: {lang}\n\nRewrite these recap captions, keeping every figure:\n\n"
        f"{json.dumps(source, ensure_ascii=False)}"
    )
    try:
        client = anthropic.Anthropic(
            api_key=api_key,
            timeout=float(getattr(settings, "LLM_REQUEST_TIMEOUT_SECONDS", 30)),
        )
        message = client.messages.create(
            model=getattr(settings, "LLM_TEXT_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=800,
            system=_POLISH_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        text = "".join(
            getattr(block, "text", "") for block in getattr(message, "content", [])
        ).strip()
        return _parse(text, source)
    except Exception as exc:  # noqa: BLE001 — best-effort, never blocks
        logger.warning("recap: LLM polish failed (%s) — template fallback", exc)
        return None


def _parse(text: str, source: dict[str, str]) -> dict[str, str] | None:
    """Validate the model's reply: same keys, non-empty strings, nothing extra.

    Anything unexpected returns ``None`` rather than a half-applied result — a recap
    with two of its five captions rewritten reads worse than one with none.
    """
    if not text:
        return None
    # Tolerate a fenced block; refuse anything else that isn't a bare object.
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[1] if "\n" in text else ""
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        logger.warning("recap: LLM polish returned non-JSON — template fallback")
        return None
    if not isinstance(parsed, dict) or set(parsed) != set(source):
        logger.warning("recap: LLM polish key mismatch — template fallback")
        return None
    out = {}
    for key, value in parsed.items():
        if not isinstance(value, str) or not value.strip():
            return None
        out[key] = value.strip()
    return out
