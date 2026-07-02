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

    def test_get_entity_registered_at_boot(self):
        assert tools.GET_ENTITY in REGISTRY

    def test_get_related_registered_at_boot(self):
        assert tools.GET_RELATED in REGISTRY

    def test_get_related_schema_requires_type_and_id(self):
        schema = REGISTRY[tools.GET_RELATED].to_schema()
        assert set(schema["input_schema"]["required"]) == {"entity_type", "id"}

    def test_search_household_schema_requires_query(self):
        schema = REGISTRY[tools.SEARCH_HOUSEHOLD].to_schema()
        assert schema["input_schema"]["required"] == ["query"]

    def test_get_entity_schema_requires_type_and_id(self):
        schema = REGISTRY[tools.GET_ENTITY].to_schema()
        assert set(schema["input_schema"]["required"]) == {"entity_type", "id"}


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


class TestGetEntity:
    def test_reads_full_content_beyond_search_truncation(
        self, household, owner, make_document
    ):
        # OCR long enough that search_household (2000-char budget) would truncate
        # before this marker; get_entity must return it in full.
        deep = "MARKER_DEEP_4000"
        long_ocr = ("ligne facturée " * 300) + " " + deep  # well past 2000 chars
        doc = make_document(name="Facture PAC", ocr_text=long_ocr)

        search_result = dispatch(
            tools.SEARCH_HOUSEHOLD,
            {"query": "facture"},
            household=household,
            user=owner,
            client=_FakeLLM(),
        )
        assert deep not in search_result.rendered  # truncated by search budget

        entity_result = dispatch(
            tools.GET_ENTITY,
            {"entity_type": "document", "id": str(doc.pk)},
            household=household,
            user=owner,
        )
        assert deep in entity_result.rendered  # full content
        assert f"id=document:{doc.pk}" in entity_result.rendered
        assert any(h.id == doc.pk for h in entity_result.hits)

    def test_missing_args_are_recoverable(self, household):
        result = dispatch(tools.GET_ENTITY, {"entity_type": "document"}, household=household)
        assert result.hits == []
        assert "entity_type and id" in result.rendered

    def test_unknown_entity_type_is_recoverable(self, household):
        result = dispatch(
            tools.GET_ENTITY,
            {"entity_type": "dragon", "id": "x"},
            household=household,
        )
        assert result.hits == []
        assert "unknown entity_type" in result.rendered

    def test_invalid_id_is_recoverable(self, household):
        result = dispatch(
            tools.GET_ENTITY,
            {"entity_type": "document", "id": "not-a-uuid"},
            household=household,
        )
        assert result.hits == []
        assert "invalid id" in result.rendered

    def test_missing_entity_is_recoverable(self, household):
        result = dispatch(
            tools.GET_ENTITY,
            {"entity_type": "document", "id": "999999999"},  # valid int, no such row
            household=household,
        )
        assert result.hits == []
        assert "no document found" in result.rendered

    def test_scoped_to_household(self, household, owner, make_document, db):
        from households.models import Household, HouseholdMember

        other = Household.objects.create(name="Other GetEntity House")
        HouseholdMember.objects.create(
            user=owner, household=other, role=HouseholdMember.Role.OWNER
        )
        doc = make_document(name="Facture Engie", ocr_text="secret")  # in `household`
        result = dispatch(
            tools.GET_ENTITY,
            {"entity_type": "document", "id": str(doc.pk)},
            household=other,  # asking from the other household
            user=owner,
        )
        assert result.hits == []
        assert "no document found" in result.rendered


@pytest.fixture
def make_project(household, owner):
    from projects.models import Project

    def _make(**overrides):
        payload = dict(household=household, created_by=owner, title="generic project")
        payload.update(overrides)
        return Project.objects.create(**payload)

    return _make


class TestGetRelated:
    def _link_document(self, project, doc):
        from projects.models import ProjectDocument

        return ProjectDocument.objects.create(project=project, document=doc)

    def test_loads_linked_items_across_types(
        self, household, owner, make_project, make_document
    ):
        from django.utils import timezone
        from interactions.models import Interaction
        from projects.models import ProjectZone
        from tasks.models import Task
        from zones.models import Zone

        project = make_project(title="Rénovation PAC")
        doc = make_document(name="devis PAC", ocr_text="montant 12000")
        self._link_document(project, doc)
        interaction = Interaction.objects.create(
            household=household, created_by=owner, subject="Dépense PAC",
            occurred_at=timezone.now(), project=project,
        )
        task = Task.objects.create(
            household=household, created_by=owner, subject="Commander la PAC", project=project
        )
        zone = Zone.objects.create(household=household, created_by=owner, name="Chaufferie")
        ProjectZone.objects.create(project=project, zone=zone)

        result = dispatch(
            tools.GET_RELATED,
            {"entity_type": "project", "id": str(project.pk)},
            household=household,
            user=owner,
        )

        found = {(h.entity_type, h.id) for h in result.hits}
        assert ("document", doc.id) in found
        assert ("interaction", interaction.id) in found
        assert ("task", task.id) in found
        assert ("zone", zone.id) in found
        assert f"id=document:{doc.id}" in result.rendered  # citable

    def test_missing_args_are_recoverable(self, household):
        result = dispatch(tools.GET_RELATED, {"entity_type": "project"}, household=household)
        assert result.hits == []
        assert "entity_type and id" in result.rendered

    def test_unknown_entity_type_is_recoverable(self, household):
        result = dispatch(
            tools.GET_RELATED, {"entity_type": "dragon", "id": "x"}, household=household
        )
        assert result.hits == []
        assert "unknown entity_type" in result.rendered

    def test_entity_without_relations_declared_is_recoverable(
        self, household, owner, make_document
    ):
        # documents don't declare a `related` traversal.
        doc = make_document(name="lonely doc")
        result = dispatch(
            tools.GET_RELATED,
            {"entity_type": "document", "id": str(doc.pk)},
            household=household,
            user=owner,
        )
        assert result.hits == []
        assert "no related items" in result.rendered

    def test_project_with_no_links_returns_empty_marker(self, household, owner, make_project):
        project = make_project(title="Solo")
        result = dispatch(
            tools.GET_RELATED,
            {"entity_type": "project", "id": str(project.pk)},
            household=household,
            user=owner,
        )
        assert result.hits == []
        assert "no items linked" in result.rendered

    def test_missing_project_is_recoverable(self, household):
        import uuid

        result = dispatch(
            tools.GET_RELATED,
            {"entity_type": "project", "id": str(uuid.uuid4())},
            household=household,
        )
        assert result.hits == []
        assert "no project found" in result.rendered

    def test_scoped_to_household(self, household, owner, make_project, make_document, db):
        from households.models import Household, HouseholdMember

        other = Household.objects.create(name="Other GetRelated House")
        HouseholdMember.objects.create(
            user=owner, household=other, role=HouseholdMember.Role.OWNER
        )
        project = make_project(title="Scoped")  # in `household`
        doc = make_document(name="secret devis")
        self._link_document(project, doc)
        result = dispatch(
            tools.GET_RELATED,
            {"entity_type": "project", "id": str(project.pk)},
            household=other,  # asking from the other household
            user=owner,
        )
        assert result.hits == []
        assert "no project found" in result.rendered


class TestCreateEntity:
    def test_creates_task_and_returns_citable_hit(self, household, owner):
        from tasks.models import Task

        result = dispatch(
            tools.CREATE_ENTITY,
            {"entity_type": "task", "fields": {"subject": "Purger la VMC"}},
            household=household,
            user=owner,
        )

        task = Task.objects.get(subject="Purger la VMC")
        assert task.household_id == household.id
        assert task.created_by_id == owner.id
        # Cited like retrieved data + surfaced as a created entity for undo.
        assert f"id=task:{task.id}" in result.rendered
        assert any(h.id == task.id for h in result.hits)
        assert result.created == [
            {
                "entity_type": "task",
                "id": str(task.id),
                "label": "Purger la VMC",
                "url_path": f"/app/tasks/{task.id}",
            }
        ]

    def test_optional_fields_are_applied(self, household, owner):
        from tasks.models import Task

        dispatch(
            tools.CREATE_ENTITY,
            {
                "entity_type": "task",
                "fields": {
                    "subject": "Commander la PAC",
                    "content": "chez Leroy Merlin",
                    "priority": 1,
                    "due_date": "2026-08-01",
                },
            },
            household=household,
            user=owner,
        )
        task = Task.objects.get(subject="Commander la PAC")
        assert task.content == "chez Leroy Merlin"
        assert task.priority == 1
        assert str(task.due_date) == "2026-08-01"

    def test_anchored_project_links_the_task(self, household, owner, make_project):
        from tasks.models import Task

        project = make_project(title="Rénovation salle de bain")
        dispatch(
            tools.CREATE_ENTITY,
            {"entity_type": "task", "fields": {"subject": "Choisir le carrelage"}},
            household=household,
            user=owner,
            context_entity=("project", str(project.pk)),
        )
        task = Task.objects.get(subject="Choisir le carrelage")
        assert task.project_id == project.pk

    def test_unknown_entity_type_is_recoverable(self, household, owner):
        result = dispatch(
            tools.CREATE_ENTITY,
            {"entity_type": "dragon", "fields": {"name": "x"}},
            household=household,
            user=owner,
        )
        assert result.created == []
        assert "cannot create 'dragon'" in result.rendered
        assert "task" in result.rendered  # lists creatable types

    def test_missing_subject_is_recoverable(self, household, owner):
        from tasks.models import Task

        result = dispatch(
            tools.CREATE_ENTITY,
            {"entity_type": "task", "fields": {"content": "no subject"}},
            household=household,
            user=owner,
        )
        assert result.created == []
        assert "could not create task" in result.rendered
        assert not Task.objects.filter(content="no subject").exists()

    def test_created_task_is_scoped_to_the_given_household(self, household, owner):
        from tasks.models import Task

        dispatch(
            tools.CREATE_ENTITY,
            {"entity_type": "task", "fields": {"subject": "Scoped task"}},
            household=household,
            user=owner,
        )
        task = Task.objects.get(subject="Scoped task")
        assert task.household_id == household.id
