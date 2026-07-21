"""Tests for the write-time vector indexing layer (parcours 21 lot 1).

No real embedding provider — a fake client returns fixed-dimension vectors, so
CI stays network-free. Covers chunking, hashing, idempotence, scope, deletion,
the non-embeddable opt-out, and the flag-gated signals.
"""
from __future__ import annotations

from dataclasses import replace

import pytest
from django.conf import settings

from agent import indexing
from agent.embeddings import EmbeddingResponse
from agent.indexing import (
    chunk_text,
    content_hash,
    reindex_instance,
    remove_instance,
)
from agent.models import EmbeddingChunk
from agent.searchables import find_spec_for_instance


class _FakeEmbeddingClient:
    """Returns one vector per text of the configured dimension. Records calls."""

    model = "fake-embed"

    def __init__(self):
        self.calls: list[dict] = []

    def embed(self, texts, *, household_id, feature="embed", user_id=None, metadata=None):
        self.calls.append({"texts": list(texts), "feature": feature})
        dim = settings.EMBEDDING_DIMENSIONS
        vectors = [[float(i % 5)] * dim for i, _ in enumerate(texts)]
        return EmbeddingResponse(vectors=vectors, model=self.model, dimensions=dim, duration_ms=1)

    def embed_query(self, text, **kwargs):
        return [0.0] * settings.EMBEDDING_DIMENSIONS


# ---------------------------------------------------------------------------
# Fixtures (mirror test_retrieval.py)
# ---------------------------------------------------------------------------
@pytest.fixture
def owner(db):
    from accounts.tests.factories import UserFactory

    return UserFactory(email="indexing-owner@example.com")


@pytest.fixture
def household(db, owner):
    from households.models import Household, HouseholdMember

    h = Household.objects.create(name="Indexing House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def make_document(household, owner):
    from documents.models import Document

    def _make(**overrides):
        payload = dict(
            household=household,
            created_by=owner,
            file_path="documents/x.pdf",
            name="Facture Engie",
            mime_type="application/pdf",
            type="document",
            ocr_text="",
            notes="",
        )
        payload.update(overrides)
        return Document.objects.create(**payload)

    return _make


# ---------------------------------------------------------------------------
# Pure functions
# ---------------------------------------------------------------------------
class TestChunkText:
    def test_empty_returns_no_chunks(self):
        assert chunk_text("") == []
        assert chunk_text("   ") == []

    def test_short_text_single_chunk(self):
        assert chunk_text("pompe à chaleur Daikin") == ["pompe à chaleur Daikin"]

    def test_long_text_splits_with_overlap(self):
        text = " ".join(f"word{i}" for i in range(1000))  # well over CHUNK_SIZE_CHARS
        chunks = chunk_text(text, size=200, overlap=40)
        assert len(chunks) > 1
        for c in chunks:
            assert len(c) <= 200 + 20  # ~size, allowing the last word to spill a little
        # Consecutive chunks overlap: the end of one reappears at the start of the next.
        first_tail = chunks[0].split()[-1]
        assert first_tail in chunks[1].split()

    def test_reconstructs_all_words(self):
        text = " ".join(f"w{i}" for i in range(300))
        chunks = chunk_text(text, size=100, overlap=20)
        seen = set()
        for c in chunks:
            seen.update(c.split())
        assert seen == set(text.split())


class TestContentHash:
    def test_stable_and_sensitive(self):
        assert content_hash("abc") == content_hash("abc")
        assert content_hash("abc") != content_hash("abd")


# ---------------------------------------------------------------------------
# reindex_instance / remove_instance
# ---------------------------------------------------------------------------
class TestReindexInstance:
    def test_creates_chunks(self, make_document, household):
        doc = make_document(ocr_text="pompe à chaleur Daikin, facture de mars 2026")
        fake = _FakeEmbeddingClient()

        written = reindex_instance(doc, client=fake)

        assert written >= 1
        rows = EmbeddingChunk.objects.filter(entity_type="document", object_id=str(doc.pk))
        assert rows.count() == written
        row = rows.first()
        assert row.household_id == household.id
        assert row.model == "fake-embed"
        assert row.content_hash
        assert len(fake.calls) == 1

    def test_idempotent_when_unchanged(self, make_document):
        doc = make_document(ocr_text="chaudière gaz Saunier Duval")
        fake = _FakeEmbeddingClient()
        reindex_instance(doc, client=fake)
        count_after_first = EmbeddingChunk.objects.count()

        # Second pass, same text + same model → no embed call, no rewrite.
        written = reindex_instance(doc, client=fake)

        assert written == 0
        assert len(fake.calls) == 1  # not called again
        assert EmbeddingChunk.objects.count() == count_after_first

    def test_reembeds_when_text_changes(self, make_document):
        doc = make_document(ocr_text="ancienne version")
        fake = _FakeEmbeddingClient()
        reindex_instance(doc, client=fake)
        old_hash = EmbeddingChunk.objects.filter(object_id=str(doc.pk)).first().content_hash

        doc.ocr_text = "nouvelle version du texte de la facture"
        doc.save()
        reindex_instance(doc, client=fake)

        new_hash = EmbeddingChunk.objects.filter(object_id=str(doc.pk)).first().content_hash
        assert new_hash != old_hash
        assert len(fake.calls) == 2

    def test_empty_text_removes_chunks(self, make_document):
        doc = make_document(ocr_text="du texte")
        fake = _FakeEmbeddingClient()
        reindex_instance(doc, client=fake)
        assert EmbeddingChunk.objects.filter(object_id=str(doc.pk)).exists()

        # Blank all searchable fields → nothing to index → chunks purged.
        doc.name = ""
        doc.ocr_text = ""
        doc.notes = ""
        doc.save()
        written = reindex_instance(doc, client=fake)

        assert written == 0
        assert not EmbeddingChunk.objects.filter(object_id=str(doc.pk)).exists()

    def test_non_embeddable_spec_is_skipped(self, make_document, monkeypatch):
        doc = make_document(ocr_text="texte indexable")
        fake = _FakeEmbeddingClient()
        reindex_instance(doc, client=fake)
        assert EmbeddingChunk.objects.filter(object_id=str(doc.pk)).exists()

        # Same entity, but its spec opts out of embedding → existing chunks purged.
        spec = find_spec_for_instance(doc)
        monkeypatch.setattr(indexing, "find_spec_for_instance", lambda _i: replace(spec, embed=False))
        written = reindex_instance(doc, client=fake)

        assert written == 0
        assert not EmbeddingChunk.objects.filter(object_id=str(doc.pk)).exists()

    def test_unregistered_instance_noop(self, household):
        # AgentConversation is not a searchable → no spec → no chunks.
        from agent.models import AgentConversation

        conv = AgentConversation.objects.create(household=household, title="x")
        assert reindex_instance(conv, client=_FakeEmbeddingClient()) == 0
        assert EmbeddingChunk.objects.count() == 0


class TestRemoveInstance:
    def test_purges_all_chunks(self, make_document):
        doc = make_document(ocr_text="quelque chose à indexer en plusieurs morceaux " * 10)
        reindex_instance(doc, client=_FakeEmbeddingClient())
        assert EmbeddingChunk.objects.filter(object_id=str(doc.pk)).exists()

        removed = remove_instance(doc)

        assert removed >= 1
        assert not EmbeddingChunk.objects.filter(object_id=str(doc.pk)).exists()


# ---------------------------------------------------------------------------
# Signals (flag-gated)
# ---------------------------------------------------------------------------
class TestSignals:
    def test_disabled_by_default_no_side_effect(self, make_document, settings):
        # Default (flag off) — creating an entity must NOT touch the vector index.
        assert settings.EMBEDDING_INDEXING_ENABLED is False
        make_document(ocr_text="ne doit pas être indexé")
        assert EmbeddingChunk.objects.count() == 0

    def test_enabled_indexes_on_save_and_delete(self, make_document, settings, monkeypatch):
        settings.EMBEDDING_INDEXING_ENABLED = True
        monkeypatch.setattr(indexing, "get_embedding_client", lambda *a, **k: _FakeEmbeddingClient())

        doc = make_document(ocr_text="indexation automatique au save")
        assert EmbeddingChunk.objects.filter(object_id=str(doc.pk)).exists()

        object_id = str(doc.pk)
        doc.delete()
        assert not EmbeddingChunk.objects.filter(object_id=object_id).exists()
