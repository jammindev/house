"""Tests for the hybrid (full-text + semantic) retrieval (parcours 21 lot 3).

Network-free: a deterministic fake embedding client maps text to a one-hot
"bucket" vector, so a query and a document land at cosine-distance 0 iff they
share a bucket — letting us drive the k-NN without a real provider. Covers the
flag-off non-regression, semantic recall (the win), exact-keyword non-regression,
household scope, stale-chunk skipping, and RRF dual-presence ranking.
"""
from __future__ import annotations

import pytest

from agent import embeddings as embeddings_module
from agent import indexing
from agent.embeddings import EmbeddingResponse
from agent.models import EmbeddingChunk
from agent.retrieval import search

_HEAT_WORDS = ("chauffage", "pompe", "chaleur", "pac", "daikin")


class _FakeEmbeddingClient:
    model = "fake-embed"

    def _vec(self, text: str):
        v = [0.0] * 1024
        v[0 if any(w in text.lower() for w in _HEAT_WORDS) else 1] = 1.0
        return v

    def embed(self, texts, *, household_id, feature="embed", user_id=None, metadata=None):
        return EmbeddingResponse(
            vectors=[self._vec(t) for t in texts], model=self.model, dimensions=1024, duration_ms=1
        )

    def embed_query(self, text, *, household_id, feature="embed", user_id=None, metadata=None):
        return self._vec(text)


@pytest.fixture
def owner(db):
    from accounts.tests.factories import UserFactory

    return UserFactory(email="hybrid-owner@example.com")


@pytest.fixture
def household(db, owner):
    from households.models import Household, HouseholdMember

    h = Household.objects.create(name="Hybrid House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def make_document(owner):
    from documents.models import Document

    def _make(household, name="Doc", ocr_text=""):
        return Document.objects.create(
            household=household,
            created_by=owner,
            file_path="documents/x.pdf",
            name=name,
            mime_type="application/pdf",
            type="document",
            ocr_text=ocr_text,
            notes="",
        )

    return _make


@pytest.fixture
def fake_embeddings(monkeypatch):
    client = _FakeEmbeddingClient()
    monkeypatch.setattr(embeddings_module, "get_embedding_client", lambda *a, **k: client)
    return client


def _index(instance, client):
    indexing.reindex_instance(instance, client=client)


def _ids(hits):
    return {str(h.id) for h in hits}


class TestFlagOff:
    def test_pure_fulltext_no_embedding_call(self, settings, household, make_document, monkeypatch):
        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = False
        doc = make_document(household, name="Pompe à chaleur", ocr_text="Daikin")

        # If the vector leg were reached it would call this and blow up.
        def _boom(*a, **k):
            raise AssertionError("embedding client must not be called when hybrid is off")

        monkeypatch.setattr(embeddings_module, "get_embedding_client", _boom)

        hits = search(household.id, "pompe")
        assert str(doc.pk) in _ids(hits)


class TestSemanticRecall:
    def test_paraphrase_surfaces_via_vector(self, settings, household, make_document, fake_embeddings):
        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = True
        # Document never says "chauffage"; full-text alone would miss the query.
        doc = make_document(household, name="Facture", ocr_text="pompe à chaleur Daikin")
        _index(doc, fake_embeddings)

        fulltext_only = {str(doc.pk)}
        # Sanity: lexical "chauffage" doesn't match the doc's text.
        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = False
        assert str(doc.pk) not in _ids(search(household.id, "chauffage"))

        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = True
        assert fulltext_only <= _ids(search(household.id, "chauffage"))


class TestNoRegressionOnExactMatch:
    def test_exact_keyword_still_returned(self, settings, household, make_document, fake_embeddings):
        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = True
        doc = make_document(household, name="Facture Engie", ocr_text="montant 142,67")
        _index(doc, fake_embeddings)
        assert str(doc.pk) in _ids(search(household.id, "Engie"))


class TestScope:
    def test_vector_leg_scoped_to_household(self, settings, make_document, fake_embeddings, owner):
        from households.models import Household, HouseholdMember

        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = True
        mine = Household.objects.create(name="Mine")
        HouseholdMember.objects.create(user=owner, household=mine, role=HouseholdMember.Role.OWNER)
        theirs = Household.objects.create(name="Theirs")
        HouseholdMember.objects.create(user=owner, household=theirs, role=HouseholdMember.Role.OWNER)

        their_doc = make_document(theirs, name="Facture", ocr_text="pompe à chaleur")
        _index(their_doc, fake_embeddings)

        # Querying my (empty) household must not surface their doc semantically.
        assert str(their_doc.pk) not in _ids(search(mine.id, "chauffage"))


class TestStaleChunk:
    def test_orphan_chunk_is_skipped(self, settings, household, fake_embeddings):
        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = True
        # A chunk whose source no longer exists must never surface.
        EmbeddingChunk.objects.create(
            household=household,
            entity_type="document",
            object_id="999999",
            chunk_index=0,
            content="pompe à chaleur",
            embedding=[1.0] + [0.0] * 1023,
            model="fake-embed",
            content_hash="x",
        )
        hits = search(household.id, "chauffage")
        assert all(str(h.id) != "999999" for h in hits)


class TestRRF:
    def test_dual_presence_ranks_first(self, settings, household, make_document, fake_embeddings):
        settings.AGENT_HYBRID_RETRIEVAL_ENABLED = True
        # both: matched lexically ("pompe") AND semantically (heat bucket)
        both = make_document(household, name="Pompe à chaleur", ocr_text="pompe à chaleur")
        # semantic-only: heat bucket, but no lexical "pompe"
        semantic_only = make_document(household, name="Radiateur", ocr_text="chaleur douce")
        _index(both, fake_embeddings)
        _index(semantic_only, fake_embeddings)

        hits = search(household.id, "pompe")
        ids = [str(h.id) for h in hits]
        assert str(both.pk) in ids and str(semantic_only.pk) in ids
        assert ids.index(str(both.pk)) < ids.index(str(semantic_only.pk))
