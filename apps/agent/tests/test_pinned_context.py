"""Tests for the pinned-context feature on AgentConversation.

Covers four areas:
A. conversations.py helpers — pin / unpin / pinned_entities
B. API endpoints — pin_context / unpin_context / search_context
C. ConversationDetailSerializer.injected_context field
D. service.ask with pinned_entities kwarg
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any
from unittest import mock

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent import service
from agent.conversations import (
    MAX_PINNED_CONTEXTS,
    pin_context,
    pinned_entities,
    unpin_context,
)
from documents.services import link_document
from agent.llm import LLMResponse, LLMRunResponse, ToolCall
from agent.models import AgentConversation
from households.models import Household, HouseholdMember

BASE = "/api/agent/conversations/"


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _with_active_household(user, household):
    user.active_household = household
    user.save(update_fields=["active_household"])


def _make_project(household, owner, **overrides):
    from projects.models import Project

    payload = dict(household=household, created_by=owner, title="Test Project")
    payload.update(overrides)
    return Project.objects.create(**payload)


# ---------------------------------------------------------------------------
# Stub LLM client (mirrors test_service.py exactly)
# ---------------------------------------------------------------------------


def _run_text(text: str, *, tokens_in: int = 5, tokens_out: int = 7) -> LLMRunResponse:
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


@dataclass
class _StubClient:
    script: list[LLMRunResponse] = field(default_factory=list)
    expansion_text: str = ""
    run_calls: list[dict[str, Any]] = field(default_factory=list)
    provider: str = "stub"

    def run(self, **kwargs) -> LLMRunResponse:
        self.run_calls.append(kwargs)
        idx = min(len(self.run_calls) - 1, len(self.script) - 1)
        return self.script[idx]

    def complete(self, **kwargs) -> LLMResponse:
        return LLMResponse(
            text=self.expansion_text,
            input_tokens=1,
            output_tokens=1,
            duration_ms=1,
            model="stub-model",
        )


# ---------------------------------------------------------------------------
# Common fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def owner(db):
    return UserFactory(email="pinned-ctx-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Pinned Ctx House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    _with_active_household(owner, h)
    return h


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def conversation(household, owner):
    return AgentConversation.objects.create(household=household, created_by=owner)


@pytest.fixture
def project(household, owner):
    return _make_project(household, owner, title="PAC Project")


@pytest.fixture
def with_api_key(settings):
    settings.ANTHROPIC_API_KEY = "sk-test-fake"
    return settings


# ---------------------------------------------------------------------------
# A. conversations.py helpers
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPinContextHelper:
    """Unit tests for pin_context / unpin_context / pinned_entities helpers."""

    def test_pin_adds_entry_and_returns_true(self, conversation, project):
        result = pin_context(conversation, "project", str(project.pk))
        assert result is True
        conversation.refresh_from_db()
        assert len(conversation.pinned_contexts) == 1
        assert conversation.pinned_contexts[0]["entity_type"] == "project"
        assert conversation.pinned_contexts[0]["object_id"] == str(project.pk)

    def test_pin_is_idempotent_returns_false_on_duplicate(self, conversation, project):
        pin_context(conversation, "project", str(project.pk))
        result = pin_context(conversation, "project", str(project.pk))
        assert result is False
        conversation.refresh_from_db()
        assert len(conversation.pinned_contexts) == 1

    def test_pin_persists_to_db(self, conversation, project):
        pin_context(conversation, "project", str(project.pk))
        fresh = AgentConversation.objects.get(pk=conversation.pk)
        assert len(fresh.pinned_contexts) == 1

    def test_pin_cap_raises_value_error_at_max_plus_one(self, conversation, household, owner):
        # Pin MAX_PINNED_CONTEXTS different projects
        for i in range(MAX_PINNED_CONTEXTS):
            p = _make_project(household, owner, title=f"Project {i}")
            pin_context(conversation, "project", str(p.pk))
        conversation.refresh_from_db()
        assert len(conversation.pinned_contexts) == MAX_PINNED_CONTEXTS

        extra = _make_project(household, owner, title="One Too Many")
        with pytest.raises(ValueError, match=str(MAX_PINNED_CONTEXTS)):
            pin_context(conversation, "project", str(extra.pk))

    def test_pin_only_modifies_pinned_contexts_field(self, conversation, project):
        original_title = conversation.title
        pin_context(conversation, "project", str(project.pk))
        conversation.refresh_from_db()
        assert conversation.title == original_title

    def test_unpin_removes_entry_and_returns_true(self, conversation, project):
        pin_context(conversation, "project", str(project.pk))
        result = unpin_context(conversation, "project", str(project.pk))
        assert result is True
        conversation.refresh_from_db()
        assert conversation.pinned_contexts == []

    def test_unpin_absent_entry_returns_false_tolerantly(self, conversation, project):
        result = unpin_context(conversation, "project", str(project.pk))
        assert result is False
        conversation.refresh_from_db()
        assert conversation.pinned_contexts == []

    def test_unpin_persists_to_db(self, conversation, project):
        pin_context(conversation, "project", str(project.pk))
        unpin_context(conversation, "project", str(project.pk))
        fresh = AgentConversation.objects.get(pk=conversation.pk)
        assert fresh.pinned_contexts == []

    def test_pinned_entities_returns_tuples(self, conversation, household, owner):
        p1 = _make_project(household, owner, title="P1")
        p2 = _make_project(household, owner, title="P2")
        pin_context(conversation, "project", str(p1.pk))
        pin_context(conversation, "project", str(p2.pk))
        conversation.refresh_from_db()

        result = pinned_entities(conversation)
        assert result == [("project", str(p1.pk)), ("project", str(p2.pk))]

    def test_pinned_entities_empty_when_none_pinned(self, conversation):
        assert pinned_entities(conversation) == []


# ---------------------------------------------------------------------------
# B. Endpoints
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPinContextEndpoint:
    """POST /api/agent/conversations/{id}/pin_context/ happy paths."""

    def test_happy_path_pins_entity_and_returns_200(
        self, owner_client, conversation, project
    ):
        resp = owner_client.post(
            f"{BASE}{conversation.id}/pin_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        # The returned conversation must carry the pin in injected_context.
        types_origins = {
            (item["entity_type"], item["object_id"], item["origin"])
            for item in body["injected_context"]
        }
        assert ("project", str(project.pk), "pinned") in types_origins

    def test_pin_persists_to_db(self, owner_client, conversation, project):
        owner_client.post(
            f"{BASE}{conversation.id}/pin_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
            format="json",
        )
        fresh = AgentConversation.objects.get(pk=conversation.id)
        assert any(
            e["entity_type"] == "project" and e["object_id"] == str(project.pk)
            for e in fresh.pinned_contexts
        )

    def test_pin_idempotent_second_call_still_200_and_one_entry(
        self, owner_client, conversation, project
    ):
        for _ in range(2):
            resp = owner_client.post(
                f"{BASE}{conversation.id}/pin_context/",
                {"entity_type": "project", "object_id": str(project.pk)},
                format="json",
            )
            assert resp.status_code == status.HTTP_200_OK
        fresh = AgentConversation.objects.get(pk=conversation.id)
        pinned = [
            e
            for e in fresh.pinned_contexts
            if e["entity_type"] == "project" and e["object_id"] == str(project.pk)
        ]
        assert len(pinned) == 1

    def test_unknown_entity_type_returns_400(self, owner_client, conversation):
        resp = owner_client.post(
            f"{BASE}{conversation.id}/pin_context/",
            {"entity_type": "dragon", "object_id": str(uuid.uuid4())},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_body_fields_returns_400(self, owner_client, conversation, project):
        # Missing object_id
        resp = owner_client.post(
            f"{BASE}{conversation.id}/pin_context/",
            {"entity_type": "project"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        # Missing entity_type
        resp = owner_client.post(
            f"{BASE}{conversation.id}/pin_context/",
            {"object_id": str(project.pk)},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_id_from_another_household_returns_404(
        self, owner_client, conversation, owner
    ):
        other_household = Household.objects.create(name="Other House")
        foreign_project = _make_project(other_household, owner, title="Foreign")
        resp = owner_client.post(
            f"{BASE}{conversation.id}/pin_context/",
            {"entity_type": "project", "object_id": str(foreign_project.pk)},
            format="json",
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_nonexistent_id_returns_404(self, owner_client, conversation):
        resp = owner_client.post(
            f"{BASE}{conversation.id}/pin_context/",
            {"entity_type": "project", "object_id": str(uuid.uuid4())},
            format="json",
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_over_cap_returns_400(self, owner_client, conversation, household, owner):
        for i in range(MAX_PINNED_CONTEXTS):
            p = _make_project(household, owner, title=f"Cap Project {i}")
            owner_client.post(
                f"{BASE}{conversation.id}/pin_context/",
                {"entity_type": "project", "object_id": str(p.pk)},
                format="json",
            )
        extra = _make_project(household, owner, title="One Too Many")
        resp = owner_client.post(
            f"{BASE}{conversation.id}/pin_context/",
            {"entity_type": "project", "object_id": str(extra.pk)},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestUnpinContextEndpoint:
    """POST /api/agent/conversations/{id}/unpin_context/ happy paths."""

    def test_unpin_removes_and_returns_200(
        self, owner_client, conversation, project
    ):
        # First pin it
        pin_context(conversation, "project", str(project.pk))
        conversation.save(update_fields=["pinned_contexts"])

        resp = owner_client.post(
            f"{BASE}{conversation.id}/unpin_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        # Gone from injected_context
        body = resp.json()
        remaining = [
            item
            for item in body["injected_context"]
            if item["entity_type"] == "project"
            and item["object_id"] == str(project.pk)
            and item["origin"] == "pinned"
        ]
        assert remaining == []

    def test_unpin_persists_removal_to_db(self, owner_client, conversation, project):
        pin_context(conversation, "project", str(project.pk))
        conversation.save(update_fields=["pinned_contexts"])

        owner_client.post(
            f"{BASE}{conversation.id}/unpin_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
            format="json",
        )
        fresh = AgentConversation.objects.get(pk=conversation.id)
        assert all(
            not (e["entity_type"] == "project" and e["object_id"] == str(project.pk))
            for e in fresh.pinned_contexts
        )

    def test_unpin_absent_entry_still_returns_200(
        self, owner_client, conversation, project
    ):
        resp = owner_client.post(
            f"{BASE}{conversation.id}/unpin_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_unpin_missing_fields_returns_400(self, owner_client, conversation):
        resp = owner_client.post(
            f"{BASE}{conversation.id}/unpin_context/",
            {"entity_type": "project"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestPinUnpinCrossHousehold:
    """Cross-household isolation: users cannot touch conversations they don't own."""

    def test_cross_household_pin_returns_404(self, household, owner, project):
        other_user = UserFactory(email="pinned-intruder@example.com")
        other_household = Household.objects.create(name="Intruder House")
        HouseholdMember.objects.create(
            user=other_user, household=other_household, role=HouseholdMember.Role.OWNER
        )
        _with_active_household(other_user, other_household)

        # Conversation belongs to owner/household
        conv = AgentConversation.objects.create(household=household, created_by=owner)
        intruder_client = _client_for(other_user)

        resp = intruder_client.post(
            f"{BASE}{conv.id}/pin_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
            format="json",
        )
        # Queryset scoping: the conversation is not in intruder's queryset → 404
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_cross_household_unpin_returns_404(self, household, owner, project):
        other_user = UserFactory(email="unpin-intruder@example.com")
        other_household = Household.objects.create(name="Intruder House 2")
        HouseholdMember.objects.create(
            user=other_user, household=other_household, role=HouseholdMember.Role.OWNER
        )
        _with_active_household(other_user, other_household)

        conv = AgentConversation.objects.create(household=household, created_by=owner)
        pin_context(conv, "project", str(project.pk))
        conv.save(update_fields=["pinned_contexts"])

        intruder_client = _client_for(other_user)
        resp = intruder_client.post(
            f"{BASE}{conv.id}/unpin_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
            format="json",
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestSearchContextEndpoint:
    """GET /api/agent/conversations/search_context/?q=

    The ``household`` fixture is required in every test so that the user has an
    active household — ``_resolve_household`` returns 400 otherwise.
    """

    def test_empty_q_returns_empty_list(self, owner_client, household):
        resp = owner_client.get(f"{BASE}search_context/", {"q": ""})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json() == []

    def test_q_missing_returns_empty_list(self, owner_client, household):
        resp = owner_client.get(f"{BASE}search_context/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json() == []

    def test_returns_matching_household_entities(self, owner_client, household, owner):
        project = _make_project(household, owner, title="Pompe à Chaleur Rénovation")
        resp = owner_client.get(f"{BASE}search_context/", {"q": "Pompe Chaleur"})
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        ids = [item["object_id"] for item in body]
        assert str(project.pk) in ids

    def test_response_shape(self, owner_client, household, owner):
        _make_project(household, owner, title="Zone Salle de bain")
        resp = owner_client.get(f"{BASE}search_context/", {"q": "Salle"})
        assert resp.status_code == status.HTTP_200_OK
        if resp.json():
            item = resp.json()[0]
            assert "entity_type" in item
            assert "object_id" in item
            assert "label" in item
            assert "url" in item
            assert "snippet" in item

    def test_excludes_other_household_entities(self, owner_client, household, owner):
        other_household = Household.objects.create(name="Search Other House")
        _make_project(other_household, owner, title="Invisible Pompe à Chaleur")
        resp = owner_client.get(f"{BASE}search_context/", {"q": "Invisible Pompe"})
        assert resp.status_code == status.HTTP_200_OK
        # Other household's project must not appear
        assert resp.json() == []

    def test_anonymous_returns_401(self):
        resp = APIClient().get(f"{BASE}search_context/", {"q": "x"})
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# C. Serializer — injected_context field
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestInjectedContextSerializer:
    """ConversationDetailSerializer.injected_context correctness."""

    def test_unanchored_conversation_has_empty_injected_context(
        self, owner_client, conversation
    ):
        resp = owner_client.get(f"{BASE}{conversation.id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["injected_context"] == []

    def test_anchored_conversation_shows_anchor_and_related(
        self, owner_client, household, owner
    ):
        from documents.models import Document

        project = _make_project(household, owner, title="Rénovation Salle de bain")
        doc = Document.objects.create(
            household=household,
            created_by=owner,
            file_path="documents/devis.pdf",
            name="Devis carrelage",
            mime_type="application/pdf",
            type="document",
            ocr_text="",
            notes="",
        )
        link_document(entity=project, document=doc)

        conv = AgentConversation.objects.create(
            household=household,
            created_by=owner,
            context_entity_type="project",
            context_object_id=str(project.pk),
        )
        resp = owner_client.get(f"{BASE}{conv.id}/")
        assert resp.status_code == status.HTTP_200_OK
        ctx = resp.json()["injected_context"]

        origins = {item["origin"] for item in ctx}
        assert "anchor" in origins
        assert "related" in origins

        anchor_item = next(i for i in ctx if i["origin"] == "anchor")
        assert anchor_item["entity_type"] == "project"
        assert anchor_item["object_id"] == str(project.pk)
        assert anchor_item["available"] is True

        # The linked document appears as 'related'
        related_ids = {i["object_id"] for i in ctx if i["origin"] == "related"}
        assert str(doc.pk) in related_ids

    def test_pinned_entity_appears_as_pinned_origin(
        self, owner_client, conversation, project
    ):
        pin_context(conversation, "project", str(project.pk))
        conversation.save(update_fields=["pinned_contexts"])

        resp = owner_client.get(f"{BASE}{conversation.id}/")
        assert resp.status_code == status.HTTP_200_OK
        ctx = resp.json()["injected_context"]

        pinned_items = [i for i in ctx if i["origin"] == "pinned"]
        assert any(i["object_id"] == str(project.pk) for i in pinned_items)

    def test_dangling_pin_appears_with_available_false(
        self, owner_client, conversation, household, owner
    ):
        # Pin a project, then delete it to create a dangling reference
        p = _make_project(household, owner, title="To Delete")
        pin_context(conversation, "project", str(p.pk))
        conversation.save(update_fields=["pinned_contexts"])
        dangling_id = str(p.pk)
        p.delete()

        resp = owner_client.get(f"{BASE}{conversation.id}/")
        assert resp.status_code == status.HTTP_200_OK
        ctx = resp.json()["injected_context"]

        dangling = [i for i in ctx if i["object_id"] == dangling_id]
        assert len(dangling) == 1
        assert dangling[0]["available"] is False
        assert dangling[0]["origin"] == "pinned"


# ---------------------------------------------------------------------------
# D. service.ask with pinned_entities
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestServiceAskPinnedEntities:
    """service.ask passes pinned entities into the prompt and citation pool."""

    def test_pinned_entity_hits_become_citable(self, with_api_key, household, owner):
        project = _make_project(household, owner, title="Citable Pinned Project")
        stub = _StubClient(
            script=[_run_text(f'Voici le projet <cite id="project:{project.pk}"/>.')]
        )
        result = service.ask(
            "parle-moi du projet",
            household,
            user=owner,
            client=stub,
            pinned_entities=[("project", str(project.pk))],
        )
        cited_ids = {c.id for c in result.citations}
        assert project.pk in cited_ids

    def test_pinned_entity_alone_makes_metadata_anchored_true(
        self, with_api_key, household, owner
    ):
        project = _make_project(household, owner, title="Solo Pinned")
        stub = _StubClient(script=[_run_text("ok")])
        result = service.ask(
            "résume",
            household,
            user=owner,
            client=stub,
            # No context_entity anchor — only a pin
            pinned_entities=[("project", str(project.pk))],
        )
        assert result.metadata["anchored"] is True

    def test_pinned_context_block_is_injected_before_question(
        self, with_api_key, household, owner
    ):
        project = _make_project(household, owner, title="Pre-injected Project")
        stub = _StubClient(script=[_run_text("ok")])
        service.ask(
            "de quoi s'agit-il ?",
            household,
            user=owner,
            client=stub,
            pinned_entities=[("project", str(project.pk))],
        )
        # The first message must contain the project label (pre-injected context block)
        first_messages = stub.run_calls[0]["messages"]
        all_content = " ".join(
            m["content"] if isinstance(m["content"], str) else str(m["content"])
            for m in first_messages
        )
        assert "Pre-injected Project" in all_content

    def test_unresolvable_pin_is_silently_dropped(self, with_api_key, household, owner):
        stub = _StubClient(script=[_run_text("ok")])
        # No exception expected, result is a valid AnswerResult
        result = service.ask(
            "bonjour",
            household,
            user=owner,
            client=stub,
            pinned_entities=[("project", str(uuid.uuid4()))],
        )
        assert result.answer == "ok"
        assert result.metadata["anchored"] is False

    def test_unresolvable_pin_does_not_pollute_citation_pool(
        self, with_api_key, household, owner
    ):
        bad_id = str(uuid.uuid4())
        stub = _StubClient(
            script=[_run_text(f'<cite id="project:{bad_id}"/>')]
        )
        result = service.ask(
            "cite something",
            household,
            user=owner,
            client=stub,
            pinned_entities=[("project", bad_id)],
        )
        # The invented citation must not appear (not in pool)
        assert result.citations == []

    def test_no_pins_and_no_anchor_leaves_anchored_false(
        self, with_api_key, household, owner
    ):
        stub = _StubClient(script=[_run_text("ok")])
        result = service.ask(
            "bonjour",
            household,
            user=owner,
            client=stub,
        )
        assert result.metadata["anchored"] is False

    def test_pinned_entities_passed_to_ask_via_view(
        self, owner_client, household, owner, project, monkeypatch
    ):
        """The view passes pinned_entities from the conversation to service.ask."""
        conv = AgentConversation.objects.create(household=household, created_by=owner)
        pin_context(conv, "project", str(project.pk))
        conv.save(update_fields=["pinned_contexts"])

        fake_result = service.AnswerResult(
            answer="ok",
            citations=[],
            metadata={"model": "m", "tokens_in": 1, "tokens_out": 2},
        )
        ask_mock = mock.Mock(return_value=fake_result)
        monkeypatch.setattr("agent.views.service.ask", ask_mock)

        owner_client.post(
            f"{BASE}{conv.id}/messages/",
            {"question": "test question"},
            format="json",
        )

        called_pins = ask_mock.call_args.kwargs.get("pinned_entities")
        assert called_pins is not None
        assert ("project", str(project.pk)) in called_pins
