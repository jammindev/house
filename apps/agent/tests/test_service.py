"""Tests for the agent.service.ask orchestrator.

The LLM client is replaced by a deterministic stub for every test — no network.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import pytest

from accounts.tests.factories import UserFactory
from agent import query_expansion, service
from agent.llm import LLMError, LLMResponse, LLMTimeoutError
from ai_usage.models import AIUsageLog
from documents.models import Document
from households.models import Household, HouseholdMember


@dataclass
class _StubLLMClient:
    """LLMClient drop-in. Records the last call and returns a canned response."""

    answer_text: str = "ok"
    raises: Exception | None = None
    last_call: dict[str, Any] | None = None
    provider: str = "stub"

    def complete(self, **kwargs):
        self.last_call = kwargs
        if self.raises:
            raise self.raises
        return LLMResponse(
            text=self.answer_text,
            input_tokens=11,
            output_tokens=22,
            duration_ms=42,
            model="stub-model",
        )


@dataclass
class _ScriptedLLMClient:
    """LLMClient drop-in that returns different text per `feature`.

    Lets a test drive the two-call flow (query expansion, then answer) with a
    distinct canned response for each stage.
    """

    by_feature: dict[str, str] = field(default_factory=dict)
    calls: list[dict[str, Any]] = field(default_factory=list)
    provider: str = "stub"

    def complete(self, **kwargs):
        self.calls.append(kwargs)
        return LLMResponse(
            text=self.by_feature.get(kwargs["feature"], ""),
            input_tokens=1,
            output_tokens=1,
            duration_ms=1,
            model="stub-model",
        )


@pytest.fixture
def owner(db):
    return UserFactory(email="agent-service-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Service House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def make_document(household, owner):
    def _make(**overrides):
        payload = dict(
            household=household,
            created_by=owner,
            file_path="documents/x.pdf",
            name="generic",
            mime_type="application/pdf",
            type="document",
            ocr_text="",
            notes="",
        )
        payload.update(overrides)
        return Document.objects.create(**payload)

    return _make


# ---------------------------------------------------------------------------
# Empty-input / no-context paths
# ---------------------------------------------------------------------------


class TestNoContext:
    def test_empty_question_returns_idk_without_calling_llm(self, household, owner):
        stub = _StubLLMClient()
        result = service.ask("", household, user=owner, client=stub)
        assert result.citations == []
        assert stub.last_call is None
        assert "trouvé" in result.answer.lower() or "do not know" in result.answer.lower()

    def test_no_retrieval_match_returns_idk_without_calling_llm(self, household, owner):
        stub = _StubLLMClient()
        result = service.ask("nothing matches this", household, user=owner, client=stub)
        assert result.citations == []
        assert stub.last_call is None
        assert result.metadata.get("reason") == service.IDK_MARKER

    def test_missing_api_key_returns_idk(self, settings, household, owner, make_document):
        settings.ANTHROPIC_API_KEY = ""
        make_document(name="Engie facture mars")
        result = service.ask("engie", household, user=owner)
        assert result.citations == []
        assert result.metadata.get("reason") == service.IDK_MARKER


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


@pytest.fixture
def with_api_key(settings):
    settings.ANTHROPIC_API_KEY = "sk-test-fake"
    return settings


class TestHappyPath:
    def test_returns_answer_and_resolves_citations_from_hits(
        self, with_api_key, household, owner, make_document
    ):
        doc = make_document(name="Engie facture mars", ocr_text="total 142,67 EUR")
        stub = _StubLLMClient(
            answer_text=(
                'Tu as payé 142,67€ chez Engie en mars '
                f'<cite id="document:{doc.pk}"/>.'
            )
        )

        result = service.ask("Engie facture", household, user=owner, client=stub)

        assert "Engie" in result.answer
        assert len(result.citations) == 1
        cit = result.citations[0]
        assert cit.entity_type == "document"
        assert cit.id == doc.pk
        assert cit.label == "Engie facture mars"
        assert cit.url_path == f"/app/documents/{doc.pk}"
        assert result.metadata["tokens_in"] == 11
        assert result.metadata["tokens_out"] == 22
        assert result.metadata["model"] == "stub-model"
        assert result.metadata["hits_count"] >= 1

    def test_passes_system_and_user_prompts_to_llm(self, with_api_key, household, owner, make_document):
        make_document(name="Engie facture mars")
        stub = _StubLLMClient(answer_text="hello")
        service.ask("engie", household, user=owner, client=stub)

        assert stub.last_call is not None
        assert "household assistant" in stub.last_call["system"].lower() or "household" in stub.last_call["system"].lower()
        assert "Engie facture mars" in stub.last_call["user"]
        assert stub.last_call["feature"] == service.FEATURE_NAME
        assert stub.last_call["household_id"] == household.id
        assert stub.last_call["user_id"] == owner.id

    def test_full_document_content_reaches_the_answer_prompt(
        self, with_api_key, household, owner, make_document
    ):
        # The amount lives deep in the OCR text, far from the matched keyword —
        # a short headline snippet would miss it. Enrichment must feed the full
        # content to the LLM so it can answer "combien ?".
        long_ocr = (
            "Facture pompe à chaleur. " + "détail " * 80
            + "Montant total 4200 EUR chez Saunier Duval."
        )
        make_document(name="facture-pac", ocr_text=long_ocr)
        stub = _StubLLMClient(answer_text="ok")

        service.ask("facture pac", household, user=owner, client=stub)

        # `last_call` is the answer call (expansion ran first). Its user prompt
        # must contain the amount pulled from the full content.
        assert stub.last_call is not None
        assert "4200" in stub.last_call["user"]
        assert "Saunier Duval" in stub.last_call["user"]

    def test_invented_citations_are_dropped(self, with_api_key, household, owner, make_document):
        make_document(name="Engie facture mars")
        stub = _StubLLMClient(
            answer_text=(
                'Voilà ta réponse <cite id="document:does-not-exist"/> '
                'avec une autre <cite id="task:00000000-0000-0000-0000-000000000000"/>.'
            )
        )
        result = service.ask("engie", household, user=owner, client=stub)
        assert result.citations == []

    def test_duplicate_citations_are_deduped(self, with_api_key, household, owner, make_document):
        doc = make_document(name="Engie facture mars")
        stub = _StubLLMClient(
            answer_text=(
                f'A <cite id="document:{doc.pk}"/> B <cite id="document:{doc.pk}"/>.'
            )
        )
        result = service.ask("engie", household, user=owner, client=stub)
        assert len(result.citations) == 1


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------


class TestErrorPaths:
    def test_timeout_propagates(self, with_api_key, household, owner, make_document):
        make_document(name="Engie facture mars")
        stub = _StubLLMClient(raises=LLMTimeoutError("timed out"))
        with pytest.raises(LLMTimeoutError):
            service.ask("engie", household, user=owner, client=stub)

    def test_llm_error_propagates(self, with_api_key, household, owner, make_document):
        make_document(name="Engie facture mars")
        stub = _StubLLMClient(raises=LLMError("boom"))
        with pytest.raises(LLMError):
            service.ask("engie", household, user=owner, client=stub)


# ---------------------------------------------------------------------------
# Query expansion
# ---------------------------------------------------------------------------


class TestQueryExpansion:
    def test_natural_language_question_finds_doc_via_expanded_keywords(
        self, with_api_key, household, owner, make_document
    ):
        # Raw sentence with filler → retrieval on it alone finds nothing.
        doc = make_document(name="Pompe à chaleur Daikin", ocr_text="PAC air-eau")
        scripted = _ScriptedLLMClient(
            by_feature={
                query_expansion.FEATURE_NAME: "pompe à chaleur, PAC, Daikin",
                service.FEATURE_NAME: f'C\'est un Daikin <cite id="document:{doc.pk}"/>.',
            }
        )

        result = service.ask(
            "trouve-moi la facture de la pompe à chaleur",
            household,
            user=owner,
            client=scripted,
        )

        assert len(result.citations) == 1
        assert result.citations[0].id == doc.pk

    def test_makes_two_calls_expansion_then_answer(
        self, with_api_key, household, owner, make_document
    ):
        doc = make_document(name="Facture Engie mars")
        scripted = _ScriptedLLMClient(
            by_feature={
                query_expansion.FEATURE_NAME: "engie, facture",
                service.FEATURE_NAME: f'ok <cite id="document:{doc.pk}"/>',
            }
        )
        service.ask("combien pour engie ?", household, user=owner, client=scripted)

        features = [c["feature"] for c in scripted.calls]
        assert features == [query_expansion.FEATURE_NAME, service.FEATURE_NAME]

    def test_expansion_never_receives_household_data(
        self, with_api_key, household, owner, make_document
    ):
        make_document(name="Facture Engie mars", ocr_text="secret montant 999")
        scripted = _ScriptedLLMClient(
            by_feature={
                query_expansion.FEATURE_NAME: "engie",
                service.FEATURE_NAME: "ok",
            }
        )
        service.ask("engie", household, user=owner, client=scripted)

        expansion_call = scripted.calls[0]
        assert expansion_call["feature"] == query_expansion.FEATURE_NAME
        # The expansion prompt is built from the question only, never the data.
        assert "999" not in expansion_call["user"]
        assert expansion_call["user"] == "engie"

    def test_no_api_key_skips_expansion_entirely(
        self, settings, household, owner, make_document
    ):
        settings.ANTHROPIC_API_KEY = ""
        make_document(name="Engie facture mars")
        scripted = _ScriptedLLMClient(by_feature={})
        result = service.ask("engie", household, user=owner, client=scripted)

        # No LLM call at all — not even for expansion.
        assert scripted.calls == []
        assert result.metadata.get("reason") == service.IDK_MARKER

    def test_expansion_failure_degrades_to_raw_question(
        self, with_api_key, household, owner, make_document
    ):
        # Expansion raises, but the raw keyword still matches → we still answer.
        doc = make_document(name="Engie facture mars")

        @dataclass
        class _FlakyExpansionClient:
            provider: str = "stub"

            def complete(self, **kwargs):
                if kwargs["feature"] == query_expansion.FEATURE_NAME:
                    raise LLMTimeoutError("expansion slow")
                return LLMResponse(
                    text=f'ok <cite id="document:{doc.pk}"/>',
                    input_tokens=1,
                    output_tokens=1,
                    duration_ms=1,
                    model="stub",
                )

        result = service.ask("engie", household, user=owner, client=_FlakyExpansionClient())
        assert len(result.citations) == 1
        assert result.citations[0].id == doc.pk


# ---------------------------------------------------------------------------
# Multi-tenant scope
# ---------------------------------------------------------------------------


class TestHouseholdScope:
    def test_other_household_data_is_never_passed_to_llm(self, with_api_key, household, owner):
        other = Household.objects.create(name="Other House")
        HouseholdMember.objects.create(
            user=owner, household=other, role=HouseholdMember.Role.OWNER
        )
        Document.objects.create(
            household=other,
            created_by=owner,
            file_path="documents/y.pdf",
            name="Engie autre foyer",
            mime_type="application/pdf",
            type="document",
        )

        stub = _StubLLMClient(answer_text="je ne sais pas")
        result = service.ask("engie", household, user=owner, client=stub)

        # Either retrieval returned nothing (IDK before LLM) or the LLM was
        # called but the prompt did not contain the other household's data.
        if stub.last_call is None:
            assert result.metadata.get("reason") == service.IDK_MARKER
        else:
            assert "Engie autre foyer" not in stub.last_call["user"]
