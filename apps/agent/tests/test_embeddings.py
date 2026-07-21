"""Tests for the embedding client abstraction.

Never hits a real provider — every call patches ``httpx.post`` so CI stays
network-free. Exercises Voyage + Ollama happy paths, the factory, logging into
``AIUsageLog``, and the error/timeout classification.
"""
from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest

from accounts.tests.factories import UserFactory
from agent.embeddings import (
    EmbeddingError,
    EmbeddingTimeoutError,
    OllamaEmbeddingClient,
    OpenAIEmbeddingClient,
    VoyageEmbeddingClient,
    get_embedding_client,
)
from ai_usage.models import AIUsageLog
from households.models import Household


@pytest.fixture
def household(db):
    return Household.objects.create(name="Embedding test household")


@pytest.fixture
def user(db):
    return UserFactory(email="embed-test@example.com")


@pytest.fixture
def with_voyage_key(settings):
    settings.VOYAGE_API_KEY = "pa-test-fake"
    return settings


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakePost:
    """Records the last httpx.post call and returns a canned payload (or raises)."""

    def __init__(self, payload=None, raises: Exception | None = None):
        self.payload = payload
        self.raises = raises
        self.calls: list[dict] = []

    def __call__(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        if self.raises:
            raise self.raises
        return _FakeResponse(self.payload)


def _voyage_payload(*vectors):
    return {
        "data": [{"index": i, "embedding": list(v)} for i, v in enumerate(vectors)],
        "usage": {"total_tokens": 42},
    }


class TestVoyageClient:
    def test_embed_returns_vectors_and_logs(self, with_voyage_key, monkeypatch, household, user):
        fake = _FakePost(payload=_voyage_payload([0.1, 0.2, 0.3], [0.4, 0.5, 0.6]))
        monkeypatch.setattr(httpx, "post", fake)

        client = VoyageEmbeddingClient(model="voyage-3")
        result = client.embed(
            ["facture engie", "pompe à chaleur"],
            household_id=household.id,
            user_id=user.id,
        )

        assert result.vectors == [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        assert result.dimensions == 3
        assert result.total_tokens == 42
        assert result.model == "voyage-3"

        # Request shape: bearer auth, document input_type, both texts.
        call = fake.calls[0]
        assert call["url"] == VoyageEmbeddingClient.API_URL
        assert call["headers"]["Authorization"] == "Bearer pa-test-fake"
        assert call["json"]["input"] == ["facture engie", "pompe à chaleur"]
        assert call["json"]["input_type"] == "document"

        log = AIUsageLog.objects.get()
        assert log.feature == "embed"
        assert log.provider == "voyage"
        assert log.model == "voyage-3"
        assert log.success is True
        assert log.input_tokens == 42
        assert log.metadata["count"] == 2
        assert log.metadata["dimensions"] == 3
        assert log.household_id == household.id
        assert log.user_id == user.id

    def test_embed_query_uses_query_input_type(self, with_voyage_key, monkeypatch, household):
        fake = _FakePost(payload=_voyage_payload([0.7, 0.8]))
        monkeypatch.setattr(httpx, "post", fake)

        vector = VoyageEmbeddingClient().embed_query("le chauffage", household_id=household.id)

        assert vector == [0.7, 0.8]
        assert fake.calls[0]["json"]["input_type"] == "query"

    def test_missing_key_raises_and_logs_failure(self, settings, monkeypatch, household):
        settings.VOYAGE_API_KEY = ""
        # Should fail before any network call — but guard anyway.
        monkeypatch.setattr(httpx, "post", _FakePost(payload=_voyage_payload([0.1])))

        with pytest.raises(EmbeddingError):
            VoyageEmbeddingClient().embed(["x"], household_id=household.id)

        log = AIUsageLog.objects.get()
        assert log.success is False
        assert log.provider == "voyage"

    def test_timeout_raises_timeout_error(self, with_voyage_key, monkeypatch, household):
        fake = _FakePost(raises=httpx.TimeoutException("timed out"))
        monkeypatch.setattr(httpx, "post", fake)

        with pytest.raises(EmbeddingTimeoutError):
            VoyageEmbeddingClient().embed(["x"], household_id=household.id)

        log = AIUsageLog.objects.get()
        assert log.success is False
        assert log.error_type == "timeout"

    def test_empty_input_short_circuits(self, with_voyage_key, monkeypatch, household):
        fake = _FakePost(payload=_voyage_payload())
        monkeypatch.setattr(httpx, "post", fake)

        result = VoyageEmbeddingClient().embed([], household_id=household.id)

        assert result.vectors == []
        assert fake.calls == []  # no network
        assert AIUsageLog.objects.count() == 0  # nothing logged


class TestOllamaClient:
    def test_embed_hits_batch_endpoint(self, monkeypatch, household):
        fake = _FakePost(payload={"embeddings": [[1.0, 2.0], [3.0, 4.0]], "prompt_eval_count": 8})
        monkeypatch.setattr(httpx, "post", fake)

        client = OllamaEmbeddingClient(model="bge-m3", base_url="http://ollama:11434/")
        result = client.embed(["a", "b"], household_id=household.id)

        assert result.vectors == [[1.0, 2.0], [3.0, 4.0]]
        assert result.total_tokens == 8
        assert fake.calls[0]["url"] == "http://ollama:11434/api/embed"
        assert fake.calls[0]["json"] == {"model": "bge-m3", "input": ["a", "b"]}

        log = AIUsageLog.objects.get()
        assert log.provider == "ollama"
        assert log.model == "bge-m3"


class TestFactory:
    def test_returns_provider_from_settings(self, settings):
        settings.EMBEDDING_PROVIDER = "voyage"
        assert isinstance(get_embedding_client(), VoyageEmbeddingClient)
        settings.EMBEDDING_PROVIDER = "ollama"
        assert isinstance(get_embedding_client(), OllamaEmbeddingClient)

    def test_explicit_override_wins(self, settings):
        settings.EMBEDDING_PROVIDER = "voyage"
        assert isinstance(get_embedding_client("ollama"), OllamaEmbeddingClient)
        assert isinstance(get_embedding_client("openai"), OpenAIEmbeddingClient)

    def test_unknown_provider_raises(self, settings):
        with pytest.raises(EmbeddingError):
            get_embedding_client("pinecone")

    def test_openai_stub_raises_and_logs(self, monkeypatch, household):
        with pytest.raises(EmbeddingError):
            OpenAIEmbeddingClient().embed(["x"], household_id=household.id)

        log = AIUsageLog.objects.get()
        assert log.provider == "openai"
        assert log.success is False
