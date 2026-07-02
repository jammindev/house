"""Tests for the agent.service.ask orchestrator (tool-use loop).

The LLM client is replaced by a scripted stub for every test — no network. The
stub drives the tool-use loop via ``run()`` (a scripted sequence of
``LLMRunResponse``) and answers query expansion, which happens inside the
``search_household`` tool, via ``complete()``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from accounts.tests.factories import UserFactory
from agent import query_expansion, service
from agent.llm import LLMError, LLMResponse, LLMRunResponse, LLMTimeoutError, ToolCall
from documents.models import Document
from households.models import Household, HouseholdMember


def _run_text(text: str, *, tokens_in: int = 5, tokens_out: int = 7) -> LLMRunResponse:
    """A final answer turn (stop_reason=end_turn, no tool calls)."""
    return LLMRunResponse(
        assistant_blocks=[{"type": "text", "text": text}],
        tool_calls=[],
        text=text,
        stop_reason="end_turn",
        input_tokens=tokens_in,
        output_tokens=tokens_out,
        duration_ms=3,
        model="stub-model",
    )


def _run_tool(query: str, *, call_id: str = "toolu_1", name: str = "search_household") -> LLMRunResponse:
    """A tool-use turn requesting ``search_household(query)``."""
    call = ToolCall(id=call_id, name=name, input={"query": query})
    return LLMRunResponse(
        assistant_blocks=[
            {"type": "tool_use", "id": call_id, "name": name, "input": {"query": query}}
        ],
        tool_calls=[call],
        text="",
        stop_reason="tool_use",
        input_tokens=4,
        output_tokens=2,
        duration_ms=2,
        model="stub-model",
    )


def _run_get_entity(entity_type: str, entity_id: str, *, call_id: str = "toolu_g") -> LLMRunResponse:
    """A tool-use turn requesting ``get_entity(entity_type, id)``."""
    args = {"entity_type": entity_type, "id": entity_id}
    call = ToolCall(id=call_id, name="get_entity", input=args)
    return LLMRunResponse(
        assistant_blocks=[{"type": "tool_use", "id": call_id, "name": "get_entity", "input": args}],
        tool_calls=[call],
        text="",
        stop_reason="tool_use",
        input_tokens=4,
        output_tokens=2,
        duration_ms=2,
        model="stub-model",
    )


def _run_get_related(entity_type: str, entity_id: str, *, call_id: str = "toolu_r") -> LLMRunResponse:
    """A tool-use turn requesting ``get_related(entity_type, id)``."""
    args = {"entity_type": entity_type, "id": entity_id}
    call = ToolCall(id=call_id, name="get_related", input=args)
    return LLMRunResponse(
        assistant_blocks=[{"type": "tool_use", "id": call_id, "name": "get_related", "input": args}],
        tool_calls=[call],
        text="",
        stop_reason="tool_use",
        input_tokens=4,
        output_tokens=2,
        duration_ms=2,
        model="stub-model",
    )


@dataclass
class _ToolUseClient:
    """LLMClient drop-in for the loop.

    ``script`` is the sequence of ``LLMRunResponse`` returned on successive
    ``run()`` calls (the last is reused if the loop runs longer).
    ``expansion_text`` is what ``complete()`` returns for query expansion.
    """

    script: list[LLMRunResponse] = field(default_factory=list)
    expansion_text: str = ""
    run_raises: Exception | None = None
    run_calls: list[dict[str, Any]] = field(default_factory=list)
    complete_calls: list[dict[str, Any]] = field(default_factory=list)
    provider: str = "stub"

    def run(self, **kwargs) -> LLMRunResponse:
        self.run_calls.append(kwargs)
        if self.run_raises:
            raise self.run_raises
        idx = min(len(self.run_calls) - 1, len(self.script) - 1)
        return self.script[idx]

    def complete(self, **kwargs) -> LLMResponse:
        self.complete_calls.append(kwargs)
        return LLMResponse(
            text=self.expansion_text,
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


@pytest.fixture
def with_api_key(settings):
    settings.ANTHROPIC_API_KEY = "sk-test-fake"
    return settings


# ---------------------------------------------------------------------------
# Fast paths — no LLM call
# ---------------------------------------------------------------------------


class TestFastPaths:
    def test_empty_question_returns_idk_without_calling_llm(self, household, owner):
        stub = _ToolUseClient(script=[_run_text("unused")])
        result = service.ask("", household, user=owner, client=stub)
        assert result.citations == []
        assert stub.run_calls == []
        assert "trouvé" in result.answer.lower()

    def test_missing_api_key_returns_idk_without_calling_llm(
        self, settings, household, owner, make_document
    ):
        settings.ANTHROPIC_API_KEY = ""
        make_document(name="Engie facture mars")
        stub = _ToolUseClient(script=[_run_text("unused")])
        result = service.ask("engie", household, user=owner, client=stub)
        assert result.citations == []
        assert result.metadata.get("reason") == service.IDK_MARKER
        assert stub.run_calls == []


# ---------------------------------------------------------------------------
# Dialogue / general knowledge — answered directly, no search
# ---------------------------------------------------------------------------


class TestDirectAnswer:
    def test_dialogue_answers_without_searching(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("Bonjour ! Comment puis-je aider ?")])
        result = service.ask("bonjour", household, user=owner, client=stub)

        assert "Bonjour" in result.answer
        assert result.citations == []
        assert result.metadata["tool_calls"] == 0
        assert result.metadata["answer_kind"] == "direct"
        assert len(stub.run_calls) == 1
        assert stub.complete_calls == []  # no query expansion, no search

    def test_general_knowledge_answers_without_searching(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("Un stère est un volume de bois d'un m³.")])
        result = service.ask("c'est quoi un stère ?", household, user=owner, client=stub)

        assert "stère" in result.answer
        assert result.citations == []
        assert result.metadata["answer_kind"] == "direct"


# ---------------------------------------------------------------------------
# Household facts — search then cite
# ---------------------------------------------------------------------------


class TestHouseholdFacts:
    def test_searches_then_answers_with_citation(
        self, with_api_key, household, owner, make_document
    ):
        doc = make_document(name="Engie facture mars", ocr_text="total 142,67 EUR")
        stub = _ToolUseClient(
            script=[
                _run_tool("Engie"),
                _run_text(f'Tu as payé 142,67€ <cite id="document:{doc.pk}"/>.'),
            ]
        )

        result = service.ask("combien pour Engie ?", household, user=owner, client=stub)

        assert len(result.citations) == 1
        cit = result.citations[0]
        assert cit.entity_type == "document"
        assert cit.id == doc.pk
        assert cit.url_path == f"/app/documents/{doc.pk}"
        assert result.metadata["tool_calls"] == 1
        assert result.metadata["hits_count"] >= 1
        assert result.metadata["answer_kind"] == "household"
        # Two round-trips (tool call + final answer) + one expansion inside tool.
        assert len(stub.run_calls) == 2
        assert any(
            c["feature"] == query_expansion.FEATURE_NAME for c in stub.complete_calls
        )

    def test_tool_result_is_fed_back_to_the_model(
        self, with_api_key, household, owner, make_document
    ):
        doc = make_document(name="Engie facture mars", ocr_text="total 142,67 EUR")
        stub = _ToolUseClient(
            script=[_run_tool("Engie"), _run_text("réponse finale")]
        )
        service.ask("combien pour Engie ?", household, user=owner, client=stub)

        # The 2nd run() carries the assistant tool_use + the tool_result block.
        second_messages = stub.run_calls[1]["messages"]
        tool_results = [
            block
            for msg in second_messages
            if isinstance(msg["content"], list)
            for block in msg["content"]
            if isinstance(block, dict) and block.get("type") == "tool_result"
        ]
        assert len(tool_results) == 1
        assert f"id=document:{doc.pk}" in tool_results[0]["content"]

    def test_search_with_no_match_leads_to_idk(self, with_api_key, household, owner, make_document):
        make_document(name="Engie facture mars")
        stub = _ToolUseClient(
            script=[
                _run_tool("zzznomatchzzz"),
                _run_text("Je ne trouve pas cette information dans tes données."),
            ]
        )
        result = service.ask("prix de la piscine ?", household, user=owner, client=stub)

        assert result.citations == []
        assert result.metadata["tool_calls"] == 1
        assert result.metadata["hits_count"] == 0
        assert result.metadata["answer_kind"] == "idk"

    def test_invented_citations_are_dropped(self, with_api_key, household, owner, make_document):
        make_document(name="Engie facture mars")
        stub = _ToolUseClient(
            script=[
                _run_tool("Engie"),
                _run_text('Réponse <cite id="document:does-not-exist"/>.'),
            ]
        )
        result = service.ask("engie ?", household, user=owner, client=stub)
        assert result.citations == []
        assert result.metadata["answer_kind"] == "uncited"

    def test_duplicate_citations_are_deduped(self, with_api_key, household, owner, make_document):
        doc = make_document(name="Engie facture mars")
        stub = _ToolUseClient(
            script=[
                _run_tool("Engie"),
                _run_text(f'A <cite id="document:{doc.pk}"/> B <cite id="document:{doc.pk}"/>.'),
            ]
        )
        result = service.ask("engie ?", household, user=owner, client=stub)
        assert len(result.citations) == 1

    def test_chains_search_then_get_entity_for_full_content(
        self, with_api_key, household, owner, make_document
    ):
        deep = "MARKER_DEEP_DETAIL"
        long_ocr = ("ligne facturée " * 300) + " " + deep
        doc = make_document(name="Facture PAC", ocr_text=long_ocr)
        stub = _ToolUseClient(
            script=[
                _run_tool("facture PAC"),
                _run_get_entity("document", str(doc.pk)),
                _run_text(f'Voici le détail complet <cite id="document:{doc.pk}"/>.'),
            ]
        )

        result = service.ask(
            "donne-moi le descriptif complet de la facture PAC",
            household,
            user=owner,
            client=stub,
        )

        assert len(result.citations) == 1
        assert result.citations[0].id == doc.pk
        assert result.metadata["tool_calls"] == 2
        # The 3rd run() received the full content (past the search truncation).
        third_messages = stub.run_calls[2]["messages"]
        full_text = "".join(
            block.get("content", "")
            for msg in third_messages
            if isinstance(msg["content"], list)
            for block in msg["content"]
            if isinstance(block, dict) and block.get("type") == "tool_result"
        )
        assert deep in full_text

    def test_chains_search_then_get_related_for_project(
        self, with_api_key, household, owner, make_document
    ):
        """The 'load everything about this project' scenario: the model searches,
        finds the project, then get_related pulls its linked document into the
        citation pool so it can be cited in the final answer."""
        from projects.models import Project, ProjectDocument

        project = Project.objects.create(
            household=household, created_by=owner, title="Pompe à chaleur"
        )
        doc = make_document(name="devis PAC", ocr_text="montant 12000")
        ProjectDocument.objects.create(project=project, document=doc)

        stub = _ToolUseClient(
            script=[
                _run_tool("pompe à chaleur"),
                _run_get_related("project", str(project.pk)),
                _run_text(
                    f'Le projet inclut le devis <cite id="document:{doc.pk}"/>.'
                ),
            ]
        )

        result = service.ask(
            "montre-moi tout ce qui concerne le projet pompe à chaleur",
            household,
            user=owner,
            client=stub,
        )

        assert result.metadata["tool_calls"] == 2
        cited_ids = {c.id for c in result.citations}
        assert doc.pk in cited_ids

    def test_multiple_searches_accumulate_into_citation_pool(
        self, with_api_key, household, owner, make_document
    ):
        doc_a = make_document(name="Engie facture", ocr_text="électricité")
        doc_b = make_document(name="Veolia facture", ocr_text="eau")
        stub = _ToolUseClient(
            script=[
                _run_tool("Engie", call_id="t1"),
                _run_tool("Veolia", call_id="t2"),
                _run_text(
                    f'Engie <cite id="document:{doc_a.pk}"/> et '
                    f'Veolia <cite id="document:{doc_b.pk}"/>.'
                ),
            ]
        )
        result = service.ask("mes factures d'énergie ?", household, user=owner, client=stub)

        cited_ids = {c.id for c in result.citations}
        assert cited_ids == {doc_a.pk, doc_b.pk}
        assert result.metadata["tool_calls"] == 2


# ---------------------------------------------------------------------------
# Loop guard
# ---------------------------------------------------------------------------


class TestLoopGuard:
    def test_caps_iterations_when_model_keeps_calling_tools(
        self, settings, with_api_key, household, owner, make_document
    ):
        settings.AGENT_MAX_TOOL_ITERATIONS = 3
        make_document(name="Engie facture mars")
        # The model never stops asking to search.
        stub = _ToolUseClient(script=[_run_tool("Engie")])

        result = service.ask("engie ?", household, user=owner, client=stub)

        assert len(stub.run_calls) == 3  # capped
        assert result.metadata["iterations"] == 3
        # No final text was ever produced → clean fallback message.
        assert "trouvé" in result.answer.lower()

    def test_tools_dropped_on_last_iteration(
        self, settings, with_api_key, household, owner, make_document
    ):
        settings.AGENT_MAX_TOOL_ITERATIONS = 2
        make_document(name="Engie facture mars")
        stub = _ToolUseClient(script=[_run_tool("Engie")])

        service.ask("engie ?", household, user=owner, client=stub)

        assert stub.run_calls[0]["tools"]  # first pass offers tools
        assert stub.run_calls[1]["tools"] == []  # last pass drops them


# ---------------------------------------------------------------------------
# Conversation history
# ---------------------------------------------------------------------------


class TestHistory:
    def test_history_is_threaded_into_messages(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("ok")])
        history = [
            {"role": "user", "content": "tu as la facture de la PAC ?"},
            {"role": "agent", "content": "Oui, je l'ai."},
        ]
        service.ask("et son prix ?", household, user=owner, client=stub, history=history)

        messages = stub.run_calls[0]["messages"]
        assert messages[0] == {"role": "user", "content": "tu as la facture de la PAC ?"}
        assert messages[1] == {"role": "assistant", "content": "Oui, je l'ai."}
        assert messages[-1] == {"role": "user", "content": "et son prix ?"}

    def test_no_history_sends_only_the_question(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("ok")])
        service.ask("bonjour", household, user=owner, client=stub)
        assert stub.run_calls[0]["messages"] == [{"role": "user", "content": "bonjour"}]

    def test_empty_history_turns_are_skipped(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("ok")])
        history = [{"role": "user", "content": "   "}, {"role": "agent", "content": ""}]
        service.ask("q", household, user=owner, client=stub, history=history)
        assert stub.run_calls[0]["messages"] == [{"role": "user", "content": "q"}]


# ---------------------------------------------------------------------------
# Metadata + prompt wiring
# ---------------------------------------------------------------------------


class TestMetadataAndWiring:
    def test_metadata_aggregates_tokens_across_iterations(
        self, with_api_key, household, owner, make_document
    ):
        make_document(name="Engie facture mars")
        stub = _ToolUseClient(script=[_run_tool("Engie"), _run_text("done")])
        result = service.ask("engie ?", household, user=owner, client=stub)

        # tool turn (4/2) + answer turn (5/7)
        assert result.metadata["tokens_in"] == 9
        assert result.metadata["tokens_out"] == 9
        assert result.metadata["model"] == "stub-model"
        assert result.metadata["iterations"] == 2
        assert result.metadata["stop_reason"] == "end_turn"

    def test_system_prompt_and_identity_are_passed(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("ok")])
        service.ask("bonjour", household, user=owner, client=stub)

        call = stub.run_calls[0]
        assert "household" in call["system"].lower()
        assert call["feature"] == service.FEATURE_NAME
        assert call["household_id"] == household.id
        assert call["user_id"] == owner.id


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------


class TestErrorPaths:
    def test_timeout_propagates(self, with_api_key, household, owner):
        stub = _ToolUseClient(run_raises=LLMTimeoutError("timed out"))
        with pytest.raises(LLMTimeoutError):
            service.ask("engie", household, user=owner, client=stub)

    def test_llm_error_propagates(self, with_api_key, household, owner):
        stub = _ToolUseClient(run_raises=LLMError("boom"))
        with pytest.raises(LLMError):
            service.ask("engie", household, user=owner, client=stub)


# ---------------------------------------------------------------------------
# Multi-tenant scope
# ---------------------------------------------------------------------------


class TestHouseholdScope:
    def test_search_never_returns_other_household_data(self, with_api_key, household, owner):
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
        stub = _ToolUseClient(
            script=[_run_tool("Engie"), _run_text("Je ne sais pas.")]
        )
        result = service.ask("engie ?", household, user=owner, client=stub)

        # The tool searched `household`, not `other` → no hits, no citation.
        assert result.citations == []
        assert result.metadata["hits_count"] == 0
