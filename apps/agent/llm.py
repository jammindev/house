"""
LLM client abstraction.

Two responsibilities:
1. Hide the provider (Anthropic today, Ollama tomorrow) behind a `LLMClient`
   Protocol so callers — `service.ask`, OCR after lot 6 refactor — never import
   the SDK directly.
2. Log every call into ``AIUsageLog`` so usage stays observable across providers
   without each caller having to remember.

`get_llm_client(provider=…)` is the single entry point. Choosing which provider
to use is a settings decision (`LLM_PROVIDER`), not a caller decision.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Protocol
from uuid import UUID

from django.conf import settings

from ai_usage.services import log_ai_usage

logger = logging.getLogger(__name__)


class LLMTimeoutError(Exception):
    """Raised when a provider call exceeds the configured timeout."""


class LLMError(Exception):
    """Raised on any other provider failure (auth, rate-limit, 5xx, …)."""


@dataclass
class LLMResponse:
    text: str
    input_tokens: int | None
    output_tokens: int | None
    duration_ms: int
    model: str


class LLMClient(Protocol):
    """Minimal contract every provider implementation must satisfy."""

    provider: str

    def complete(
        self,
        *,
        system: str,
        user: str,
        feature: str,
        household_id: UUID | str,
        user_id: int | None = None,
        max_tokens: int = 1024,
        metadata: dict[str, Any] | None = None,
    ) -> LLMResponse:
        ...


class AnthropicClient:
    """Concrete Anthropic SDK wrapper. Logs every call into ``AIUsageLog``."""

    provider = "anthropic"

    def __init__(self, *, model: str | None = None, timeout: float | None = None):
        self.model = model or getattr(settings, "LLM_TEXT_MODEL", "claude-haiku-4-5-20251001")
        self.timeout = timeout or float(getattr(settings, "LLM_REQUEST_TIMEOUT_SECONDS", 30))

    def _client(self):
        api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
        if not api_key:
            raise LLMError("ANTHROPIC_API_KEY is not configured")
        try:
            import anthropic
        except ImportError as exc:
            raise LLMError("anthropic SDK not installed") from exc
        return anthropic.Anthropic(api_key=api_key, timeout=self.timeout)

    def complete(
        self,
        *,
        system: str,
        user: str,
        feature: str,
        household_id: UUID | str,
        user_id: int | None = None,
        max_tokens: int = 1024,
        metadata: dict[str, Any] | None = None,
    ) -> LLMResponse:
        started = time.monotonic()
        try:
            client = self._client()
            message = client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
        except Exception as exc:
            duration_ms = int((time.monotonic() - started) * 1000)
            error_type = _classify_error(exc)
            log_ai_usage(
                household_id=household_id,
                user_id=user_id,
                feature=feature,
                provider=self.provider,
                model=self.model,
                duration_ms=duration_ms,
                success=False,
                error_type=error_type,
                metadata=metadata,
            )
            if error_type == "timeout":
                raise LLMTimeoutError(str(exc)) from exc
            raise LLMError(str(exc)) from exc

        duration_ms = int((time.monotonic() - started) * 1000)
        text = _extract_text(message)
        usage = getattr(message, "usage", None)
        input_tokens = getattr(usage, "input_tokens", None) if usage else None
        output_tokens = getattr(usage, "output_tokens", None) if usage else None

        log_ai_usage(
            household_id=household_id,
            user_id=user_id,
            feature=feature,
            provider=self.provider,
            model=self.model,
            duration_ms=duration_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            success=True,
            metadata=metadata,
        )

        return LLMResponse(
            text=text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            duration_ms=duration_ms,
            model=self.model,
        )


def _extract_text(message) -> str:
    parts: list[str] = []
    for block in getattr(message, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
        elif isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "\n".join(p for p in parts if p).strip()


def _classify_error(exc: Exception) -> str:
    """Map provider exceptions to a short error_type tag for ``AIUsageLog``."""
    name = type(exc).__name__.lower()
    if "timeout" in name:
        return "timeout"
    if "rate" in name and "limit" in name:
        return "rate_limit"
    if "auth" in name:
        return "auth"
    if "connection" in name:
        return "connection"
    return name or "unknown"


def get_llm_client(provider: str | None = None) -> LLMClient:
    """Return the configured LLM client. Override the provider for tests/scripts."""
    chosen = (provider or getattr(settings, "LLM_PROVIDER", "anthropic")).lower()
    if chosen == "anthropic":
        return AnthropicClient()
    raise LLMError(f"Unknown LLM provider: {chosen!r}")
