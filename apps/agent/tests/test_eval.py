"""Tests for the retrieval eval harness + index status (parcours 21 lot 4).

Metrics are pure (no DB, no network). The command smoke tests use full-text mode
(no embeddings) and direct chunk rows, so nothing hits a provider.
"""
from __future__ import annotations

import json
from io import StringIO

import pytest
from django.core.management import call_command

from agent.eval.metrics import evaluate, mean, recall_at_k, reciprocal_rank
from agent.models import EmbeddingChunk


class TestMetrics:
    def test_recall_at_k(self):
        assert recall_at_k(["a", "b", "c"], {"a", "c"}, k=3) == 1.0
        assert recall_at_k(["a", "b", "c"], {"a", "z"}, k=3) == 0.5
        assert recall_at_k(["x", "a"], {"a"}, k=1) == 0.0  # a is below k
        assert recall_at_k(["a"], set(), k=3) == 0.0  # nothing relevant

    def test_reciprocal_rank(self):
        assert reciprocal_rank(["a", "b"], {"a"}) == 1.0
        assert reciprocal_rank(["a", "b"], {"b"}) == 0.5
        assert reciprocal_rank(["a", "b"], {"z"}) == 0.0

    def test_mean(self):
        assert mean([1.0, 0.0]) == 0.5
        assert mean([]) == 0.0

    def test_evaluate_skips_empty_relevant(self):
        runs = [
            (["doc:1", "doc:2"], ["doc:1"]),  # recall 1.0, rr 1.0
            (["doc:9"], []),  # skipped (no relevant)
            (["doc:5", "doc:3"], ["doc:3"]),  # recall 1.0, rr 0.5
        ]
        result = evaluate(runs, k=10)
        assert result["queries"] == 2
        assert result["recall_at_k"] == 1.0
        assert result["mrr"] == 0.75


@pytest.fixture
def owner(db):
    from accounts.tests.factories import UserFactory

    return UserFactory(email="eval-owner@example.com")


@pytest.fixture
def household(db, owner):
    from households.models import Household, HouseholdMember

    h = Household.objects.create(name="Eval House")
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


class TestEvalRetrievalCommand:
    def test_fulltext_mode_scores_a_match(self, household, make_document, tmp_path):
        doc = make_document(household, name="Facture Engie", ocr_text="montant")
        golden = [{"question": "Engie", "expected": [f"document:{doc.pk}"]}]
        path = tmp_path / "golden.json"
        path.write_text(json.dumps(golden), encoding="utf-8")

        out = StringIO()
        call_command(
            "eval_retrieval",
            household=str(household.id),
            queries=str(path),
            mode="fulltext",
            k=10,
            stdout=out,
        )
        output = out.getvalue()
        assert "fulltext" in output
        assert "1.000" in output  # the exact-keyword match is recalled


class TestEmbeddingsStatusCommand:
    def test_reports_coverage(self, household, make_document):
        doc = make_document(household, name="Indexé", ocr_text="texte")
        EmbeddingChunk.objects.create(
            household=household,
            entity_type="document",
            object_id=str(doc.pk),
            chunk_index=0,
            content="texte",
            embedding=[0.1] * 1024,
            model="some-old-model",  # != current EMBEDDING_MODEL → counts as stale
            content_hash="h",
        )
        out = StringIO()
        call_command("embeddings_status", household=str(household.id), stdout=out)
        output = out.getvalue()
        assert "document" in output
        assert "TOTAL" in output
