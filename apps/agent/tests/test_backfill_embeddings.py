"""Tests for the `backfill_embeddings` management command (parcours 21 lot 2).

Network-free: a fake embedding client is injected via monkeypatch. Covers
dry-run (no writes), real indexing, --limit, --household, --entity-type, --force,
and resilience (one failing entity doesn't abort the batch).
"""
from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from agent.embeddings import EmbeddingResponse
from agent.management.commands import backfill_embeddings as cmd_module
from agent.models import EmbeddingChunk


class _FakeEmbeddingClient:
    model = "fake-embed"

    def embed(self, texts, *, household_id, feature="embed", user_id=None, metadata=None):
        if any("BOOM" in t for t in texts):
            raise ValueError("simulated provider failure")
        dim = 1024
        return EmbeddingResponse(
            vectors=[[0.1] * dim for _ in texts],
            model=self.model,
            dimensions=dim,
            duration_ms=1,
        )


@pytest.fixture
def owner(db):
    from accounts.tests.factories import UserFactory

    return UserFactory(email="backfill-owner@example.com")


@pytest.fixture
def household(db, owner):
    from households.models import Household, HouseholdMember

    h = Household.objects.create(name="Backfill House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def other_household(db, owner):
    from households.models import Household, HouseholdMember

    h = Household.objects.create(name="Other Backfill House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def make_document(owner):
    from documents.models import Document

    def _make(household, **overrides):
        payload = dict(
            household=household,
            created_by=owner,
            file_path="documents/x.pdf",
            name="Doc",
            mime_type="application/pdf",
            type="document",
            ocr_text="contenu à indexer",
            notes="",
        )
        payload.update(overrides)
        return Document.objects.create(**payload)

    return _make


@pytest.fixture(autouse=True)
def _fake_client(monkeypatch):
    monkeypatch.setattr(cmd_module, "get_embedding_client", lambda *a, **k: _FakeEmbeddingClient())


def _run(**kwargs):
    out = StringIO()
    call_command("backfill_embeddings", stdout=out, stderr=out, **kwargs)
    return out.getvalue()


def _object_ids(household):
    """Distinct source ids indexed for a household (scoped so a --reuse-db test
    database with leftover rows from other households can't leak in)."""
    return set(
        EmbeddingChunk.objects.filter(household=household).values_list("object_id", flat=True)
    )


class TestBackfillEmbeddings:
    def test_dry_run_writes_nothing(self, make_document, household):
        make_document(household, ocr_text="facture engie mars")
        output = _run(dry_run=True)
        assert "[dry-run]" in output
        assert EmbeddingChunk.objects.count() == 0

    def test_indexes_entities(self, make_document, household):
        # entity_type=document: a household auto-creates a root Zone (also
        # searchable), so scope to documents to keep the count deterministic.
        make_document(household, ocr_text="pompe à chaleur")
        make_document(household, ocr_text="chaudière gaz")
        _run(household=str(household.id), entity_type="document")
        assert len(_object_ids(household)) == 2

    def test_limit_caps_processing(self, make_document, household):
        for i in range(4):
            make_document(household, ocr_text=f"doc numero {i}")
        _run(household=str(household.id), entity_type="document", limit=2)
        assert len(_object_ids(household)) == 2

    def test_household_filter(self, make_document, household, other_household):
        mine = make_document(household, ocr_text="chez moi")
        theirs = make_document(other_household, ocr_text="chez eux")
        _run(household=str(household.id))
        assert str(mine.pk) in _object_ids(household)
        assert str(theirs.pk) not in _object_ids(household)
        assert str(theirs.pk) not in _object_ids(other_household)  # not touched at all

    def test_entity_type_filter_unknown_raises(self):
        with pytest.raises(CommandError):
            _run(entity_type="does_not_exist")

    def test_force_reembeds(self, make_document, household):
        make_document(household, ocr_text="texte stable")
        _run(household=str(household.id), entity_type="document")
        before = EmbeddingChunk.objects.filter(household=household, entity_type="document").count()
        # Idempotent second run without --force: no change.
        _run(household=str(household.id), entity_type="document")
        assert (
            EmbeddingChunk.objects.filter(household=household, entity_type="document").count()
            == before
        )
        # --force rebuilds regardless.
        output = _run(household=str(household.id), entity_type="document", force=True)
        assert "indexed" in output
        assert (
            EmbeddingChunk.objects.filter(household=household, entity_type="document").count()
            == before
        )

    def test_one_failure_does_not_abort(self, make_document, household):
        make_document(household, ocr_text="bon document")
        make_document(household, ocr_text="document BOOM cassé")
        output = _run(household=str(household.id), entity_type="document")
        # The good one is indexed, the batch reports one failure, run completes.
        assert "1 failed" in output
        assert len(_object_ids(household)) == 1
