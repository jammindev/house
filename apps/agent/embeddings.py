"""
Embedding client abstraction — the vector counterpart of ``apps/agent/llm.py``.

Anthropic provides **no** embeddings API: Claude stays the generation engine, but
the vectors used by the hybrid retrieval (parcours 21) come from a separate
provider. That provider is a settings decision (``EMBEDDING_PROVIDER``), never a
caller decision — exactly like ``LLMClient`` hides Anthropic/Ollama for generation.

- **Voyage AI** (``voyage``, default) — hosted API, called over REST via ``httpx``
  (no heavy SDK). Chosen for prod because the 4 GB VPS can't hold a local model
  next to the app. See docs/fiches/EMBEDDINGS.md §6.
- **Ollama** (``ollama``) — local model over HTTP (``/api/embed``). The target once
  the machine has ≥ 8 GB RAM; flip ``EMBEDDING_PROVIDER=ollama``, no refactor.
- **OpenAI** (``openai``) — optional stub, not wired.

``get_embedding_client(provider=…)`` is the single entry point. Every call is
logged into ``AIUsageLog`` (feature defaults to ``embed``) so embedding usage
stays observable across providers, just like generation.
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

# Default AIUsageLog feature tag for embedding calls. Indexing/query callers may
# override it (e.g. "embed_index", "embed_query") to split usage in the logs.
DEFAULT_EMBED_FEATURE = "embed"

# Voyage asymmetric embeddings: documents and queries are embedded with a
# different `input_type` for better retrieval. Providers that ignore it (Ollama)
# simply drop the hint.
INPUT_TYPE_DOCUMENT = "document"
INPUT_TYPE_QUERY = "query"


class EmbeddingError(Exception):
    """Raised on any embedding provider failure (auth, rate-limit, 5xx, config…)."""


class EmbeddingTimeoutError(EmbeddingError):
    """Raised when an embedding provider call exceeds the configured timeout."""


@dataclass
class EmbeddingResponse:
    """Result of one embedding call — one vector per input text, in order."""

    vectors: list[list[float]]
    model: str
    dimensions: int
    duration_ms: int
    # Total tokens billed, when the provider reports it (Voyage does, Ollama may).
    total_tokens: int | None = None


class EmbeddingClient(Protocol):
    """Provider-neutral embedding contract consumed by the retrieval/indexing layer."""

    provider: str

    def embed(
        self,
        texts: list[str],
        *,
        household_id: UUID | str,
        feature: str = DEFAULT_EMBED_FEATURE,
        user_id: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> EmbeddingResponse:
        """Embed a batch of documents (``input_type=document``)."""
        ...

    def embed_query(
        self,
        text: str,
        *,
        household_id: UUID | str,
        feature: str = DEFAULT_EMBED_FEATURE,
        user_id: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> list[float]:
        """Embed a single search query (``input_type=query``) and return its vector."""
        ...


class _BaseEmbeddingClient:
    """Shared timing + logging + error handling. Providers implement ``_embed_raw``.

    Mirrors the logging discipline of ``AnthropicClient`` in ``llm.py``: every
    call — success or failure — writes one ``AIUsageLog`` row, and failures never
    leak the provider's native exception (always ``EmbeddingError`` subclasses).
    """

    provider = "base"
    model = ""

    def _embed_raw(
        self, texts: list[str], *, input_type: str
    ) -> tuple[list[list[float]], int | None]:
        """Provider-specific call. Return ``(vectors, total_tokens)``."""
        raise NotImplementedError

    def _run(
        self,
        texts: list[str],
        *,
        input_type: str,
        household_id: UUID | str,
        feature: str,
        user_id: int | None,
        metadata: dict[str, Any] | None,
    ) -> EmbeddingResponse:
        started = time.monotonic()
        try:
            vectors, total_tokens = self._embed_raw(texts, input_type=input_type)
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
        dimensions = len(vectors[0]) if vectors and vectors[0] else 0
        log_ai_usage(
            household_id=household_id,
            user_id=user_id,
            feature=feature,
            provider=self.provider,
            model=self.model,
            duration_ms=duration_ms,
            input_tokens=total_tokens,
            success=True,
            metadata={**(metadata or {}), "count": len(vectors), "dimensions": dimensions},
        )
        return EmbeddingResponse(
            vectors=vectors,
            model=self.model,
            dimensions=dimensions,
            duration_ms=duration_ms,
            total_tokens=total_tokens,
        )

    def embed(
        self,
        texts: list[str],
        *,
        household_id: UUID | str,
        feature: str = DEFAULT_EMBED_FEATURE,
        user_id: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> EmbeddingResponse:
        if not texts:
            return EmbeddingResponse(vectors=[], model=self.model, dimensions=0, duration_ms=0)
        return self._run(
            list(texts),
            input_type=INPUT_TYPE_DOCUMENT,
            household_id=household_id,
            feature=feature,
            user_id=user_id,
            metadata=metadata,
        )

    def embed_query(
        self,
        text: str,
        *,
        household_id: UUID | str,
        feature: str = DEFAULT_EMBED_FEATURE,
        user_id: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> list[float]:
        response = self._run(
            [text],
            input_type=INPUT_TYPE_QUERY,
            household_id=household_id,
            feature=feature,
            user_id=user_id,
            metadata=metadata,
        )
        return response.vectors[0] if response.vectors else []

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
        """Log a failed embedding call and re-raise as the right EmbeddingError."""
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
            raise EmbeddingTimeoutError(str(exc)) from exc
        raise EmbeddingError(str(exc)) from exc


class VoyageEmbeddingClient(_BaseEmbeddingClient):
    """Voyage AI over its REST endpoint (no SDK — httpx, like the Ollama path).

    The ``voyageai`` SDK pulls a heavy tree (langchain/numpy/tokenizers); the REST
    call is a single POST, so we keep the prod image lean.
    """

    provider = "voyage"
    API_URL = "https://api.voyageai.com/v1/embeddings"

    def __init__(self, *, model: str | None = None, timeout: float | None = None):
        self.model = model or getattr(settings, "EMBEDDING_MODEL", "voyage-3")
        self.timeout = timeout or float(getattr(settings, "EMBEDDING_REQUEST_TIMEOUT_SECONDS", 30))

    def _embed_raw(self, texts, *, input_type):
        api_key = getattr(settings, "VOYAGE_API_KEY", "") or ""
        if not api_key:
            raise EmbeddingError("VOYAGE_API_KEY is not configured")
        import httpx

        response = httpx.post(
            self.API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": self.model, "input": texts, "input_type": input_type},
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        # Voyage returns data sorted by index, but sort defensively to preserve order.
        rows = sorted(payload.get("data", []), key=lambda row: row.get("index", 0))
        vectors = [row["embedding"] for row in rows]
        total_tokens = (payload.get("usage") or {}).get("total_tokens")
        return vectors, total_tokens


class OllamaEmbeddingClient(_BaseEmbeddingClient):
    """Local Ollama over HTTP (`/api/embed` batch endpoint). Target for RAM ≥ 8 GB."""

    provider = "ollama"

    def __init__(
        self,
        *,
        model: str | None = None,
        base_url: str | None = None,
        timeout: float | None = None,
    ):
        self.model = model or getattr(settings, "EMBEDDING_MODEL", "bge-m3")
        base = base_url or getattr(settings, "EMBEDDING_BASE_URL", "http://localhost:11434")
        self.base_url = base.rstrip("/")
        self.timeout = timeout or float(getattr(settings, "EMBEDDING_REQUEST_TIMEOUT_SECONDS", 60))

    def _embed_raw(self, texts, *, input_type):
        # Ollama's embedding models are symmetric — input_type carries no meaning
        # here, so it is intentionally ignored.
        import httpx

        response = httpx.post(
            f"{self.base_url}/api/embed",
            json={"model": self.model, "input": texts},
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        vectors = payload.get("embeddings") or []
        total_tokens = payload.get("prompt_eval_count")
        return vectors, total_tokens


class OpenAIEmbeddingClient(_BaseEmbeddingClient):
    """Optional stub — branchable porte de sortie, not implemented (see EMBEDDINGS.md)."""

    provider = "openai"

    def __init__(self, *, model: str | None = None, timeout: float | None = None):
        self.model = model or getattr(settings, "EMBEDDING_MODEL", "text-embedding-3-small")

    def _embed_raw(self, texts, *, input_type):
        raise EmbeddingError(
            "OpenAIEmbeddingClient is not implemented — set EMBEDDING_PROVIDER=voyage or ollama"
        )


def _classify_error(exc: Exception) -> str:
    """Map provider exceptions to a short error_type tag for ``AIUsageLog``."""
    name = type(exc).__name__.lower()
    if "timeout" in name:
        return "timeout"
    if "rate" in name and "limit" in name:
        return "rate_limit"
    if "auth" in name or "unauthorized" in name:
        return "auth"
    if "connect" in name:
        return "connection"
    return name or "unknown"


_CLIENTS: dict[str, type[_BaseEmbeddingClient]] = {
    "voyage": VoyageEmbeddingClient,
    "ollama": OllamaEmbeddingClient,
    "openai": OpenAIEmbeddingClient,
}


def get_embedding_client(provider: str | None = None) -> EmbeddingClient:
    """Return the configured embedding client. Override the provider for tests/scripts."""
    chosen = (provider or getattr(settings, "EMBEDDING_PROVIDER", "voyage")).lower()
    try:
        return _CLIENTS[chosen]()
    except KeyError:
        raise EmbeddingError(f"Unknown embedding provider: {chosen!r}") from None
