"""
Helper to log a single AI provider call into ``AIUsageLog``.

Designed to be called from inside an LLM client implementation (`AnthropicClient`,
future `OllamaClient`, …) right after a `messages.create()` returns or fails.
Failure to log must NEVER bubble up into the caller — the log is observability,
not business logic.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from .models import AIUsageLog

logger = logging.getLogger(__name__)


def log_ai_usage(
    *,
    household_id: UUID | str,
    feature: str,
    model: str,
    duration_ms: int,
    user_id: int | None = None,
    provider: str = "anthropic",
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    success: bool = True,
    error_type: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AIUsageLog | None:
    """Persist a single AI call. Returns the row, or ``None`` if logging itself failed."""
    try:
        return AIUsageLog.objects.create(
            household_id=household_id,
            user_id=user_id,
            feature=feature,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            duration_ms=duration_ms,
            success=success,
            error_type=error_type,
            metadata=metadata or {},
        )
    except Exception as exc:
        logger.warning("ai_usage: log failed (feature=%s, model=%s): %s", feature, model, exc)
        return None
