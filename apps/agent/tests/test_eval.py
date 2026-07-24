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
            no_expand=True,
            stdout=out,
        )
        output = out.getvalue()
        assert "fulltext" in output
        assert "1.000" in output  # the exact-keyword match is recalled


class _FakeLLM:
    provider = "anthropic"
    model = "fake"

    def complete(self, *, system, user, feature, household_id, max_tokens=1024, metadata=None):
        from agent.llm import LLMResponse

        return LLMResponse(
            text="Où est ma facture Engie ?",
            input_tokens=1,
            output_tokens=1,
            duration_ms=1,
            model=self.model,
        )


class TestAutoGolden:
    def test_builds_golden_from_entities(self, household, make_document, tmp_path, monkeypatch):
        from agent import llm as llm_module

        doc = make_document(household, name="Engie", ocr_text="facture engie electricite")
        monkeypatch.setattr(llm_module, "get_llm_client", lambda *a, **k: _FakeLLM())

        path = tmp_path / "auto.json"
        out = StringIO()
        call_command(
            "eval_retrieval",
            household=str(household.id),
            auto=10,  # >= entity count so the document gets a question too
            mode="fulltext",
            auto_out=str(path),
            no_expand=True,
            stdout=out,
        )

        golden = json.loads(path.read_text(encoding="utf-8"))
        assert any(entry["expected"] == [f"document:{doc.pk}"] for entry in golden)
        assert all("question" in entry and entry["question"] for entry in golden)


class _TermsLLM:
    provider = "anthropic"
    model = "fake"

    def complete(self, *, system, user, feature, household_id, user_id=None, max_tokens=1024, metadata=None):
        from agent.llm import LLMResponse

        return LLMResponse(
            text="Engie, facture", input_tokens=1, output_tokens=1, duration_ms=1, model=self.model
        )


class TestExpansionPath:
    def test_expansion_makes_fulltext_find_keywordless_question(
        self, household, make_document, tmp_path, monkeypatch
    ):
        from agent import llm as llm_module

        # Question shares NO word with the doc → raw full-text misses it; expansion
        # (mocked → "Engie, facture") turns it into keywords that DO match.
        doc = make_document(household, name="Engie", ocr_text="facture electricite du mois")
        golden = [{"question": "chez qui je paie le courant ?", "expected": [f"document:{doc.pk}"]}]
        path = tmp_path / "g.json"
        path.write_text(json.dumps(golden), encoding="utf-8")
        monkeypatch.setattr(llm_module, "get_llm_client", lambda *a, **k: _TermsLLM())

        out = StringIO()
        call_command(
            "eval_retrieval", household=str(household.id), queries=str(path), mode="fulltext", k=10, stdout=out
        )
        assert "1.000" in out.getvalue()


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
