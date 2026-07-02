"""Tests for the agent tool registry + the search_household tool.

Retrieval runs against the real Postgres full-text layer, but the LLM is always
faked — query expansion degrades to the raw query when the fake returns no
extra terms, so there is zero network in CI.
"""
from __future__ import annotations

import pytest

from agent import tools
from agent.llm import LLMResponse
from agent.tools import (
    REGISTRY,
    AgentTool,
    ToolResult,
    build_search_household_tool,
    dispatch,
    register,
    reset_registry,
    schemas,
)


@pytest.fixture
def owner(db):
    from accounts.tests.factories import UserFactory

    return UserFactory(email="tools-owner@example.com")


@pytest.fixture
def household(db, owner):
    from households.models import Household, HouseholdMember

    h = Household.objects.create(name="Tools House")
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
            name="generic",
            mime_type="application/pdf",
            type="document",
            ocr_text="",
            notes="",
        )
        payload.update(overrides)
        return Document.objects.create(**payload)

    return _make


class _FakeLLM:
    """Fake LLM client: query expansion falls back to the raw query."""

    provider = "fake"

    def complete(self, **kwargs) -> LLMResponse:
        return LLMResponse(text="", input_tokens=1, output_tokens=1, duration_ms=0, model="fake")

    def run(self, **kwargs):  # pragma: no cover - not used by these tests
        raise NotImplementedError


@pytest.fixture
def fresh_registry():
    """Snapshot/restore the global registry so a test can't pollute others."""
    snapshot = dict(REGISTRY)
    reset_registry()
    yield
    reset_registry()
    REGISTRY.update(snapshot)


def _dummy_tool(name: str = "dummy") -> AgentTool:
    return AgentTool(
        name=name,
        description="dummy",
        input_schema={"type": "object", "properties": {}},
        handler=lambda **kw: ToolResult(rendered="ok"),
    )


class TestRegistry:
    def test_register_adds_tool(self, fresh_registry):
        tool = _dummy_tool()
        register(tool)
        assert REGISTRY["dummy"] is tool

    def test_double_register_raises(self, fresh_registry):
        register(_dummy_tool())
        with pytest.raises(ValueError, match="already registered"):
            register(_dummy_tool())

    def test_schemas_exposes_name_description_input_schema(self, fresh_registry):
        register(_dummy_tool("alpha"))
        (schema,) = schemas()
        assert schema["name"] == "alpha"
        assert schema["description"] == "dummy"
        assert schema["input_schema"] == {"type": "object", "properties": {}}


class TestBootRegistry:
    def test_search_household_registered_at_boot(self):
        assert tools.SEARCH_HOUSEHOLD in REGISTRY

    def test_search_household_schema_requires_query(self):
        schema = REGISTRY[tools.SEARCH_HOUSEHOLD].to_schema()
        assert schema["input_schema"]["required"] == ["query"]


class TestDispatch:
    def test_unknown_tool_returns_recoverable_result(self, household):
        result = dispatch("nope", {}, household=household)
        assert isinstance(result, ToolResult)
        assert "unknown tool" in result.rendered.lower()
        assert result.hits == []

    def test_dispatch_routes_to_handler(self, fresh_registry, household):
        register(_dummy_tool("alpha"))
        result = dispatch("alpha", {}, household=household)
        assert result.rendered == "ok"


class TestSearchHousehold:
    def test_empty_query_searches_nothing(self, household):
        result = dispatch(
            tools.SEARCH_HOUSEHOLD, {"query": "   "}, household=household, client=_FakeLLM()
        )
        assert result.hits == []
        assert "empty query" in result.rendered.lower()

    def test_returns_hits_and_citable_block(self, household, owner, make_document):
        doc = make_document(name="Facture Engie mars", ocr_text="total 142,67 EUR Engie")
        result = dispatch(
            tools.SEARCH_HOUSEHOLD,
            {"query": "Engie"},
            household=household,
            user=owner,
            client=_FakeLLM(),
        )
        assert any(h.id == doc.id for h in result.hits)
        assert f"id=document:{doc.id}" in result.rendered
        assert "Facture Engie mars" in result.rendered

    def test_no_match_returns_empty_marker(self, household, owner, make_document):
        make_document(name="Facture Engie", ocr_text="électricité")
        result = dispatch(
            tools.SEARCH_HOUSEHOLD,
            {"query": "zzznomatchzzz"},
            household=household,
            user=owner,
            client=_FakeLLM(),
        )
        assert result.hits == []
        assert "no household items matched" in result.rendered.lower()

    def test_scoped_to_household(self, household, owner, make_document, db):
        from households.models import Household, HouseholdMember

        other = Household.objects.create(name="Other Tools House")
        HouseholdMember.objects.create(
            user=owner, household=other, role=HouseholdMember.Role.OWNER
        )
        make_document(name="Facture Engie", ocr_text="Engie")  # in `household`
        result = dispatch(
            tools.SEARCH_HOUSEHOLD,
            {"query": "Engie"},
            household=other,
            user=owner,
            client=_FakeLLM(),
        )
        assert result.hits == []
