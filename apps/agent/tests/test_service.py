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

from documents.services import link_document

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


def _run_create(entity_type: str, fields: dict, *, call_id: str = "toolu_c") -> LLMRunResponse:
    """A tool-use turn requesting ``create_entity(entity_type, fields)``."""
    args = {"entity_type": entity_type, "fields": fields}
    call = ToolCall(id=call_id, name="create_entity", input=args)
    return LLMRunResponse(
        assistant_blocks=[{"type": "tool_use", "id": call_id, "name": "create_entity", "input": args}],
        tool_calls=[call],
        text="",
        stop_reason="tool_use",
        input_tokens=4,
        output_tokens=2,
        duration_ms=2,
        model="stub-model",
    )


def _run_update(entity_type: str, entity_id: str, fields: dict, *, call_id: str = "toolu_u") -> LLMRunResponse:
    """A tool-use turn requesting ``update_entity(entity_type, id, fields)``."""
    args = {"entity_type": entity_type, "id": entity_id, "fields": fields}
    call = ToolCall(id=call_id, name="update_entity", input=args)
    return LLMRunResponse(
        assistant_blocks=[{"type": "tool_use", "id": call_id, "name": "update_entity", "input": args}],
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

    def test_single_quoted_citations_are_resolved(
        self, with_api_key, household, owner, make_document
    ):
        doc = make_document(name="Engie facture mars")
        stub = _ToolUseClient(
            script=[
                _run_tool("Engie"),
                _run_text(f"Tu as payé 142,67€ <cite id='document:{doc.pk}'/>."),
            ]
        )
        result = service.ask("engie ?", household, user=owner, client=stub)
        assert [c.id for c in result.citations] == [doc.pk]

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
        from projects.models import Project

        project = Project.objects.create(
            household=household, created_by=owner, title="Pompe à chaleur"
        )
        doc = make_document(name="devis PAC", ocr_text="montant 12000")
        link_document(entity=project, document=doc)

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

    def test_truncated_flag_set_when_answer_hits_max_tokens(
        self, with_api_key, household, owner
    ):
        cut = _run_text("Réponse coupée en plein")
        cut.stop_reason = "max_tokens"
        stub = _ToolUseClient(script=[cut])
        result = service.ask("bonjour", household, user=owner, client=stub)
        assert result.metadata["truncated"] is True

    def test_truncated_flag_false_on_normal_answer(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("ok")])
        result = service.ask("bonjour", household, user=owner, client=stub)
        assert result.metadata["truncated"] is False

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
# Anchored conversation — pre-injected entity context
# ---------------------------------------------------------------------------


@pytest.fixture
def make_project(household, owner):
    from projects.models import Project

    def _make(**overrides):
        payload = dict(household=household, created_by=owner, title="generic project")
        payload.update(overrides)
        return Project.objects.create(**payload)

    return _make


class TestAnchoredContext:
    def test_context_is_pre_injected_and_citable_without_searching(
        self, with_api_key, household, owner, make_project, make_document
    ):

        project = make_project(title="Pompe à chaleur", description="devis en cours")
        doc = make_document(name="devis PAC", ocr_text="montant 12000")
        link_document(entity=project, document=doc)

        # The model answers directly (no tool call), citing the anchor's document.
        stub = _ToolUseClient(
            script=[_run_text(f'Le devis est de 12000€ <cite id="document:{doc.pk}"/>.')]
        )
        result = service.ask(
            "fais-moi le point sur ce projet",
            household,
            user=owner,
            client=stub,
            context_entity=("project", str(project.pk)),
        )

        # Cited the pre-injected document without any search_household call.
        assert {c.id for c in result.citations} == {doc.pk}
        assert result.metadata["tool_calls"] == 0
        assert result.metadata["anchored"] is True

        # The very first message carries the labelled, citable context block.
        first_msg = stub.run_calls[0]["messages"][0]
        assert first_msg["role"] == "user"
        assert "Pompe à chaleur" in first_msg["content"]
        assert f"id=document:{doc.pk}" in first_msg["content"]
        # Followed by an assistant ack, then the real question.
        assert stub.run_calls[0]["messages"][1]["role"] == "assistant"
        assert stub.run_calls[0]["messages"][-1]["content"] == "fais-moi le point sur ce projet"

    def test_anchored_system_prompt_is_used(
        self, with_api_key, household, owner, make_project
    ):
        project = make_project(title="Solo")
        stub = _ToolUseClient(script=[_run_text("ok")])
        service.ask(
            "résume",
            household,
            user=owner,
            client=stub,
            context_entity=("project", str(project.pk)),
        )
        # The anchored addendum extends the base system prompt.
        assert "CURRENT ITEM CONTEXT" in stub.run_calls[0]["system"]

    def test_orphaned_anchor_falls_back_to_unanchored(
        self, with_api_key, household, owner
    ):
        import uuid

        stub = _ToolUseClient(script=[_run_text("ok")])
        result = service.ask(
            "résume",
            household,
            user=owner,
            client=stub,
            context_entity=("project", str(uuid.uuid4())),
        )
        # No context injected: plain question only, base prompt, not anchored.
        assert result.metadata["anchored"] is False
        assert stub.run_calls[0]["messages"] == [{"role": "user", "content": "résume"}]
        assert "CURRENT ITEM CONTEXT" not in stub.run_calls[0]["system"]


# ---------------------------------------------------------------------------
# Write actions — create_entity
# ---------------------------------------------------------------------------


class TestCreateEntity:
    def test_create_populates_created_entities_metadata(
        self, with_api_key, household, owner
    ):
        from tasks.models import Task

        stub = _ToolUseClient(
            script=[
                _run_create("task", {"subject": "Purger la VMC"}),
                _run_text("C'est noté."),
            ]
        )
        result = service.ask(
            "ajoute une tâche : purger la VMC", household, user=owner, client=stub
        )

        task = Task.objects.get(subject="Purger la VMC")
        assert result.metadata["created_entities"] == [
            {
                "entity_type": "task",
                "id": str(task.id),
                "label": "Purger la VMC",
                "url_path": f"/app/tasks/{task.id}",
            }
        ]
        assert result.metadata["tool_calls"] == 1

    def test_anchored_create_links_the_project(
        self, with_api_key, household, owner, make_project
    ):
        from tasks.models import Task

        project = make_project(title="Rénovation salle de bain")
        stub = _ToolUseClient(
            script=[
                _run_create("task", {"subject": "Choisir le carrelage"}),
                _run_text("Ajouté au projet."),
            ]
        )
        service.ask(
            "ajoute une tâche choisir le carrelage",
            household,
            user=owner,
            client=stub,
            context_entity=("project", str(project.pk)),
        )
        task = Task.objects.get(subject="Choisir le carrelage")
        assert task.project_id == project.pk

    def test_duplicate_create_in_one_turn_is_skipped(
        self, with_api_key, household, owner
    ):
        from tasks.models import Task

        stub = _ToolUseClient(
            script=[
                _run_create("task", {"subject": "Doublon"}, call_id="c1"),
                _run_create("task", {"subject": "Doublon"}, call_id="c2"),
                _run_text("Fait."),
            ]
        )
        result = service.ask("crée la tâche", household, user=owner, client=stub)

        assert Task.objects.filter(subject="Doublon").count() == 1
        assert len(result.metadata["created_entities"]) == 1

    def test_no_write_leaves_created_entities_empty(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("Bonjour !")])
        result = service.ask("bonjour", household, user=owner, client=stub)
        assert result.metadata["created_entities"] == []


class TestUpdateEntity:
    def test_update_populates_updated_entities_metadata(
        self, with_api_key, household, owner
    ):
        from tasks.models import Task

        task = Task.objects.create(
            household=household, created_by=owner, subject="Purger la VMC"
        )
        stub = _ToolUseClient(
            script=[
                _run_update("task", str(task.pk), {"status": "done"}),
                _run_text(f'Marquée faite <cite id="task:{task.pk}"/>.'),
            ]
        )
        result = service.ask(
            "marque la tâche comme faite", household, user=owner, client=stub
        )

        task.refresh_from_db()
        assert task.status == "done"
        assert result.metadata["updated_entities"] == [
            {
                "entity_type": "task",
                "id": str(task.pk),
                "label": "Purger la VMC",
                "url_path": f"/app/tasks/{task.pk}",
                "previous": {"status": "pending"},
                "changed": {"status": "done"},
            }
        ]
        # The updated item is citable like retrieved data.
        assert [c.id for c in result.citations] == [task.pk]

    def test_duplicate_update_in_one_turn_is_skipped(
        self, with_api_key, household, owner
    ):
        from tasks.models import Task

        task = Task.objects.create(
            household=household, created_by=owner, subject="Doublon update"
        )
        stub = _ToolUseClient(
            script=[
                _run_update("task", str(task.pk), {"status": "done"}, call_id="u1"),
                _run_update("task", str(task.pk), {"status": "done"}, call_id="u2"),
                _run_text("Fait."),
            ]
        )
        result = service.ask("marque-la faite", household, user=owner, client=stub)
        assert len(result.metadata["updated_entities"]) == 1

    def test_no_write_leaves_updated_entities_empty(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("Bonjour !")])
        result = service.ask("bonjour", household, user=owner, client=stub)
        assert result.metadata["updated_entities"] == []


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


# ---------------------------------------------------------------------------
# Web search (server-side tool)
# ---------------------------------------------------------------------------


def _run_pause(web_sources, *, blocks=None) -> LLMRunResponse:
    """A `pause_turn` turn: the server web-search loop paused mid-turn."""
    return LLMRunResponse(
        assistant_blocks=blocks
        or [{"type": "server_tool_use", "id": "s1", "name": "web_search", "input": {"query": "q"}}],
        tool_calls=[],
        text="",
        stop_reason="pause_turn",
        input_tokens=3,
        output_tokens=1,
        duration_ms=1,
        model="stub-model",
        web_sources=web_sources,
    )


class TestWebSearch:
    def test_flag_passed_to_run_when_enabled(self, with_api_key, settings, household, owner):
        settings.AGENT_WEB_SEARCH_ENABLED = True
        stub = _ToolUseClient(script=[_run_text("Bonjour")])
        service.ask("salut", household, user=owner, client=stub)
        assert stub.run_calls[0]["web_search"] is True

    def test_flag_off_by_default(self, with_api_key, household, owner):
        stub = _ToolUseClient(script=[_run_text("Bonjour")])
        service.ask("salut", household, user=owner, client=stub)
        assert stub.run_calls[0]["web_search"] is False

    def test_pause_turn_resumes_and_collects_web_sources(
        self, with_api_key, settings, household, owner
    ):
        settings.AGENT_WEB_SEARCH_ENABLED = True
        source = {"url": "https://ex.com/a", "title": "A"}
        stub = _ToolUseClient(script=[_run_pause([source]), _run_text("La réponse web.")])

        result = service.ask("actu du jour ?", household, user=owner, client=stub)

        # The pause_turn turn was replayed (2 run calls) and resumed to an answer.
        assert len(stub.run_calls) == 2
        assert result.answer == "La réponse web."
        assert result.metadata["web_sources"] == [source]
        assert result.metadata["answer_kind"] == "web"

    def test_pause_resume_on_last_iteration_keeps_tools(
        self, with_api_key, settings, household, owner
    ):
        # max=2: iter1 pauses, iter2 is the "final forced-answer" pass. Resuming a
        # paused search must keep tools declared (else the server can't continue).
        settings.AGENT_WEB_SEARCH_ENABLED = True
        settings.AGENT_MAX_TOOL_ITERATIONS = 2
        stub = _ToolUseClient(script=[_run_pause([]), _run_text("Fini.")])

        service.ask("actu ?", household, user=owner, client=stub)

        assert len(stub.run_calls) == 2
        # The resume pass (2nd, the last iteration) still offers the tools.
        assert stub.run_calls[1]["tools"]
        assert stub.run_calls[1]["web_search"] is True

    def test_web_sources_deduped_by_url(self, with_api_key, settings, household, owner):
        settings.AGENT_WEB_SEARCH_ENABLED = True
        dup = {"url": "https://ex.com/a", "title": "A"}
        final = _run_text("Réponse.")
        final.web_sources = [dup, {"url": "https://ex.com/b", "title": "B"}]
        stub = _ToolUseClient(script=[_run_pause([dup]), final])

        result = service.ask("actu ?", household, user=owner, client=stub)

        urls = [s["url"] for s in result.metadata["web_sources"]]
        assert urls == ["https://ex.com/a", "https://ex.com/b"]

    def test_caller_disarm_overrides_enabled_instance(
        self, with_api_key, settings, household, owner
    ):
        # Instance capability ON but the conversation didn't arm it → tool stays off.
        settings.AGENT_WEB_SEARCH_ENABLED = True
        stub = _ToolUseClient(script=[_run_text("Bonjour")])
        service.ask("salut", household, user=owner, client=stub, allow_web_search=False)
        assert stub.run_calls[0]["web_search"] is False

    def test_caller_arm_cannot_bypass_disabled_instance(
        self, with_api_key, household, owner
    ):
        # Capability OFF (default) → arming the conversation can't turn it on.
        stub = _ToolUseClient(script=[_run_text("Bonjour")])
        service.ask("salut", household, user=owner, client=stub, allow_web_search=True)
        assert stub.run_calls[0]["web_search"] is False
