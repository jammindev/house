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
from typing import Any, NoReturn, Protocol
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


@dataclass
class ToolCall:
    """A single tool invocation requested by the model."""

    id: str
    name: str
    input: dict[str, Any]


@dataclass
class LLMRunResponse:
    """Result of one tool-enabled round-trip.

    Unlike ``LLMResponse`` (a single text completion), this carries everything a
    tool-use loop needs: the assistant turn to replay, the tool calls to
    dispatch, and the stop reason that tells the caller whether to loop again.
    """

    # The assistant content normalized to serializable dicts, ready to append to
    # the running ``messages`` list before the next call.
    assistant_blocks: list[dict]
    # The ``tool_use`` blocks extracted for dispatch (empty when the model answered).
    tool_calls: list[ToolCall]
    # Concatenated text blocks — the final answer when ``stop_reason == "end_turn"``.
    text: str
    stop_reason: str
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

    def run(
        self,
        *,
        system: str,
        messages: list[dict],
        tools: list[dict],
        feature: str,
        household_id: UUID | str,
        user_id: int | None = None,
        max_tokens: int = 1024,
        metadata: dict[str, Any] | None = None,
    ) -> LLMRunResponse:
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
            self._log_and_raise_failure(
                exc,
                started=started,
                feature=feature,
                household_id=household_id,
                user_id=user_id,
                metadata=metadata,
            )

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

    def run(
        self,
        *,
        system: str,
        messages: list[dict],
        tools: list[dict],
        feature: str,
        household_id: UUID | str,
        user_id: int | None = None,
        max_tokens: int = 1024,
        metadata: dict[str, Any] | None = None,
    ) -> LLMRunResponse:
        """One tool-enabled round-trip. The tool-use loop lives in the caller.

        This makes a single ``messages.create`` call with the provided
        conversation ``messages`` and ``tools``, logs it into ``AIUsageLog``, and
        returns the assistant turn (normalized), the requested tool calls, and
        the stop reason so the caller can decide whether to loop.
        """
        started = time.monotonic()
        try:
            client = self._client()
            create_kwargs: dict[str, Any] = {
                "model": self.model,
                "max_tokens": max_tokens,
                # One cache breakpoint at the end of the system block caches the
                # whole prefix before the messages (tool schemas + system prompt)
                # across loop iterations and conversation turns (5-min TTL).
                "system": [
                    {
                        "type": "text",
                        "text": system,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                "messages": messages,
            }
            if tools:
                create_kwargs["tools"] = tools
            message = client.messages.create(**create_kwargs)
        except Exception as exc:
            self._log_and_raise_failure(
                exc,
                started=started,
                feature=feature,
                household_id=household_id,
                user_id=user_id,
                metadata=metadata,
            )

        duration_ms = int((time.monotonic() - started) * 1000)
        assistant_blocks = _normalize_blocks(message)
        tool_calls = _extract_tool_calls(message)
        text = _extract_text(message)
        stop_reason = getattr(message, "stop_reason", "") or ""
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
            metadata=_with_cache_usage(metadata, usage),
        )

        return LLMRunResponse(
            assistant_blocks=assistant_blocks,
            tool_calls=tool_calls,
            text=text,
            stop_reason=stop_reason,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            duration_ms=duration_ms,
            model=self.model,
        )

    def _log_and_raise_failure(
        self,
        exc: Exception,
        *,
        started: float,
        feature: str,
        household_id: UUID | str,
        user_id: int | None,
        metadata: dict[str, Any] | None,
    ) -> NoReturn:
        """Log a failed provider call and re-raise as the right LLM error.

        Shared by ``complete`` and ``run`` — never returns (always raises).
        """
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


def _with_cache_usage(metadata: dict[str, Any] | None, usage) -> dict[str, Any] | None:
    """Fold the provider's prompt-cache counters into the AIUsageLog metadata.

    Lets us verify from the logs that prefix caching actually hits (reads grow,
    creations stay rare). No-op when the provider reports nothing.
    """
    extra = {
        key: getattr(usage, key, None)
        for key in ("cache_read_input_tokens", "cache_creation_input_tokens")
        if usage is not None and getattr(usage, key, None) is not None
    }
    if not extra:
        return metadata
    return {**(metadata or {}), **extra}


def _block_get(block, key, default=None):
    """Read ``key`` from an SDK content block, tolerating dicts and objects."""
    if isinstance(block, dict):
        return block.get(key, default)
    return getattr(block, key, default)


def _normalize_blocks(message) -> list[dict]:
    """Convert SDK content blocks into serializable dicts for replay.

    The assistant turn (text + tool_use blocks) must be appended back to the
    ``messages`` list before the next call. We normalize to plain dicts so the
    caller never depends on SDK object types.
    """
    blocks: list[dict] = []
    for block in getattr(message, "content", []) or []:
        btype = _block_get(block, "type")
        if btype == "text":
            blocks.append({"type": "text", "text": _block_get(block, "text") or ""})
        elif btype == "tool_use":
            blocks.append(
                {
                    "type": "tool_use",
                    "id": _block_get(block, "id"),
                    "name": _block_get(block, "name"),
                    "input": _block_get(block, "input") or {},
                }
            )
    return blocks


def _extract_tool_calls(message) -> list[ToolCall]:
    """Extract the ``tool_use`` blocks of a message into ``ToolCall`` records."""
    calls: list[ToolCall] = []
    for block in getattr(message, "content", []) or []:
        if _block_get(block, "type") == "tool_use":
            calls.append(
                ToolCall(
                    id=_block_get(block, "id"),
                    name=_block_get(block, "name"),
                    input=_block_get(block, "input") or {},
                )
            )
    return calls


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
