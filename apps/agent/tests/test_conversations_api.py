"""Tests for the /api/agent/conversations/ endpoints."""
from __future__ import annotations

from unittest import mock

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent import service
from agent.llm import LLMError, LLMTimeoutError
from agent.models import AgentConversation, AgentMessage
from households.models import Household, HouseholdMember


BASE = "/api/agent/conversations/"


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _with_active_household(user, household):
    user.active_household = household
    user.save(update_fields=["active_household"])


@pytest.fixture
def owner(db):
    return UserFactory(email="conv-api-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Conv API House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    _with_active_household(owner, h)
    return h


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def conversation(household, owner):
    return AgentConversation.objects.create(household=household, created_by=owner)


def _answer(text="ok", citations=None, metadata=None):
    return service.AnswerResult(
        answer=text,
        citations=citations or [],
        metadata=metadata or {"model": "m", "tokens_in": 1, "tokens_out": 2},
    )


def _patch_ask(monkeypatch, return_value=None, side_effect=None):
    fake = mock.Mock(return_value=return_value, side_effect=side_effect)
    monkeypatch.setattr("agent.views.service.ask", fake)
    return fake


def _rows(resp):
    """Return the list rows whether or not the endpoint paginates."""
    body = resp.json()
    if isinstance(body, dict) and "results" in body:
        return body["results"]
    return body


class TestAuth:
    def test_anonymous_is_rejected(self):
        resp = APIClient().get(BASE)
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


class TestCreateAndList:
    def test_create_conversation(self, owner_client, household):
        resp = owner_client.post(BASE, {"title": "Chaudière"}, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        conv = AgentConversation.objects.get(id=resp.json()["id"])
        assert conv.created_by_id is not None
        assert conv.household_id == household.id
        assert conv.title == "Chaudière"

    def test_list_only_my_conversations(self, owner_client, household, owner):
        AgentConversation.objects.create(household=household, created_by=owner, title="mine")
        other = UserFactory(email="other-conv@example.com")
        HouseholdMember.objects.create(
            user=other, household=household, role=HouseholdMember.Role.MEMBER
        )
        AgentConversation.objects.create(household=household, created_by=other, title="theirs")

        resp = owner_client.get(BASE)
        assert resp.status_code == status.HTTP_200_OK
        titles = {c["title"] for c in _rows(resp)}
        assert "mine" in titles
        assert "theirs" not in titles

    def test_list_includes_message_count(self, owner_client, conversation):
        AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.USER, content="q"
        )
        resp = owner_client.get(BASE)
        row = next(r for r in _rows(resp) if r["id"] == str(conversation.id))
        assert row["message_count"] == 1


class TestRetrieve:
    def test_retrieve_includes_messages(self, owner_client, conversation):
        AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.USER, content="Q1"
        )
        AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.AGENT, content="A1"
        )
        resp = owner_client.get(f"{BASE}{conversation.id}/")
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert [m["content"] for m in body["messages"]] == ["Q1", "A1"]

    def test_cannot_retrieve_another_users_conversation(self, owner_client, household):
        other = UserFactory(email="stranger@example.com")
        HouseholdMember.objects.create(
            user=other, household=household, role=HouseholdMember.Role.MEMBER
        )
        theirs = AgentConversation.objects.create(household=household, created_by=other)
        resp = owner_client.get(f"{BASE}{theirs.id}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


class TestPostMessage:
    def test_happy_path_persists_both_turns_and_returns_agent_message(
        self, owner_client, conversation, monkeypatch
    ):
        result = _answer(
            text='4200 EUR <cite id="document:abc"/>',
            citations=[
                service.Citation(
                    entity_type="document", id="abc", label="facture-pac",
                    snippet="pompe", url_path="/app/documents/abc",
                )
            ],
        )
        _patch_ask(monkeypatch, return_value=result)

        resp = owner_client.post(
            f"{BASE}{conversation.id}/messages/",
            {"question": "combien coûte la PAC ?"},
            format="json",
        )

        assert resp.status_code == status.HTTP_201_CREATED
        body = resp.json()
        assert body["role"] == "agent"
        assert body["content"] == '4200 EUR <cite id="document:abc"/>'
        assert body["citations"][0]["label"] == "facture-pac"

        roles = list(conversation.messages.values_list("role", "content"))
        assert roles == [("user", "combien coûte la PAC ?"), ("agent", result.answer)]

    def test_sets_recency_and_auto_title_on_first_message(
        self, owner_client, conversation, monkeypatch
    ):
        _patch_ask(monkeypatch, return_value=_answer())
        owner_client.post(
            f"{BASE}{conversation.id}/messages/",
            {"question": "Quand a-t-on changé la chaudière ?"},
            format="json",
        )
        conversation.refresh_from_db()
        assert conversation.title == "Quand a-t-on changé la chaudière ?"
        assert conversation.last_message_at is not None

    def test_existing_title_is_not_overwritten(self, owner_client, household, owner, monkeypatch):
        conv = AgentConversation.objects.create(
            household=household, created_by=owner, title="Mon titre"
        )
        _patch_ask(monkeypatch, return_value=_answer())
        owner_client.post(
            f"{BASE}{conv.id}/messages/", {"question": "autre chose"}, format="json"
        )
        conv.refresh_from_db()
        assert conv.title == "Mon titre"

    def test_prior_turns_are_threaded_as_history(
        self, owner_client, conversation, monkeypatch
    ):
        AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.USER,
            content="tu as la facture de la PAC ?",
        )
        AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.AGENT, content="Oui, facture-pac.",
        )
        ask_mock = _patch_ask(monkeypatch, return_value=_answer())

        owner_client.post(
            f"{BASE}{conversation.id}/messages/", {"question": "et son prix ?"}, format="json"
        )

        history = ask_mock.call_args.kwargs["history"]
        assert history == [
            {"role": "user", "content": "tu as la facture de la PAC ?"},
            {"role": "agent", "content": "Oui, facture-pac."},
        ]

    def test_blank_question_rejected(self, owner_client, conversation, monkeypatch):
        _patch_ask(monkeypatch, return_value=_answer())
        resp = owner_client.post(
            f"{BASE}{conversation.id}/messages/", {"question": "  "}, format="json"
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_timeout_returns_504_and_persists_nothing(
        self, owner_client, conversation, monkeypatch
    ):
        _patch_ask(monkeypatch, side_effect=LLMTimeoutError("slow"))
        resp = owner_client.post(
            f"{BASE}{conversation.id}/messages/", {"question": "x"}, format="json"
        )
        assert resp.status_code == status.HTTP_504_GATEWAY_TIMEOUT
        assert conversation.messages.count() == 0

    def test_llm_error_returns_503_and_persists_nothing(
        self, owner_client, conversation, monkeypatch
    ):
        _patch_ask(monkeypatch, side_effect=LLMError("boom"))
        resp = owner_client.post(
            f"{BASE}{conversation.id}/messages/", {"question": "x"}, format="json"
        )
        assert resp.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert conversation.messages.count() == 0

    def test_cannot_post_to_another_users_conversation(self, owner_client, household):
        other = UserFactory(email="intruder-target@example.com")
        HouseholdMember.objects.create(
            user=other, household=household, role=HouseholdMember.Role.MEMBER
        )
        theirs = AgentConversation.objects.create(household=household, created_by=other)
        resp = owner_client.post(
            f"{BASE}{theirs.id}/messages/", {"question": "x"}, format="json"
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND


class TestForContext:
    """GET /conversations/for_context/ — one conversation per (user, entity)."""

    def _make_project(self, household, owner):
        from projects.models import Project

        return Project.objects.create(
            household=household, created_by=owner, title="Assistant projet"
        )

    def test_creates_anchored_conversation_on_first_visit(
        self, owner_client, household, owner
    ):
        project = self._make_project(household, owner)
        resp = owner_client.get(
            f"{BASE}for_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
        )
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body["context_entity_type"] == "project"
        assert body["context_object_id"] == str(project.pk)
        assert body["messages"] == []
        conv = AgentConversation.objects.get(id=body["id"])
        assert conv.has_context

    def test_is_idempotent_returns_same_conversation(
        self, owner_client, household, owner
    ):
        project = self._make_project(household, owner)
        params = {"entity_type": "project", "object_id": str(project.pk)}
        first = owner_client.get(f"{BASE}for_context/", params).json()
        second = owner_client.get(f"{BASE}for_context/", params).json()
        assert first["id"] == second["id"]
        assert AgentConversation.objects.filter(
            context_entity_type="project", context_object_id=str(project.pk)
        ).count() == 1

    def test_returns_existing_messages(self, owner_client, household, owner):
        project = self._make_project(household, owner)
        conv = AgentConversation.objects.create(
            household=household, created_by=owner,
            context_entity_type="project", context_object_id=str(project.pk),
        )
        AgentMessage.objects.create(
            conversation=conv, role=AgentMessage.Role.USER, content="salut"
        )
        resp = owner_client.get(
            f"{BASE}for_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
        )
        assert resp.json()["id"] == str(conv.id)
        assert [m["content"] for m in resp.json()["messages"]] == ["salut"]

    def test_isolated_per_user(self, owner_client, household, owner):
        project = self._make_project(household, owner)
        other = UserFactory(email="ctx-other@example.com")
        HouseholdMember.objects.create(
            user=other, household=household, role=HouseholdMember.Role.MEMBER
        )
        AgentConversation.objects.create(
            household=household, created_by=other,
            context_entity_type="project", context_object_id=str(project.pk),
        )
        # Owner gets/creates their OWN conversation, not the other user's.
        resp = owner_client.get(
            f"{BASE}for_context/",
            {"entity_type": "project", "object_id": str(project.pk)},
        )
        conv = AgentConversation.objects.get(id=resp.json()["id"])
        assert conv.created_by_id == owner.id

    def test_unknown_entity_type_rejected(self, owner_client, household):
        resp = owner_client.get(
            f"{BASE}for_context/", {"entity_type": "dragon", "object_id": "x"}
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_params_rejected(self, owner_client, household):
        resp = owner_client.get(f"{BASE}for_context/", {"entity_type": "project"})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


class TestAnchoredMessage:
    def test_context_entity_is_passed_to_ask(
        self, owner_client, household, owner, monkeypatch
    ):
        from projects.models import Project

        project = Project.objects.create(
            household=household, created_by=owner, title="Projet ancré"
        )
        conv = AgentConversation.objects.create(
            household=household, created_by=owner,
            context_entity_type="project", context_object_id=str(project.pk),
        )
        ask_mock = _patch_ask(monkeypatch, return_value=_answer())

        owner_client.post(
            f"{BASE}{conv.id}/messages/", {"question": "le point ?"}, format="json"
        )

        assert ask_mock.call_args.kwargs["context_entity"] == (
            "project",
            str(project.pk),
        )

    def test_unanchored_conversation_passes_no_context(
        self, owner_client, conversation, monkeypatch
    ):
        ask_mock = _patch_ask(monkeypatch, return_value=_answer())
        owner_client.post(
            f"{BASE}{conversation.id}/messages/", {"question": "hello"}, format="json"
        )
        assert ask_mock.call_args.kwargs["context_entity"] is None


class TestCreatedEntitiesInResponse:
    def test_message_response_carries_created_entities(
        self, owner_client, conversation, monkeypatch
    ):
        created = [
            {
                "entity_type": "task",
                "id": "t-1",
                "label": "Purger la VMC",
                "url_path": "/app/tasks/t-1",
            }
        ]
        _patch_ask(
            monkeypatch,
            return_value=_answer(metadata={"model": "m", "created_entities": created}),
        )
        resp = owner_client.post(
            f"{BASE}{conversation.id}/messages/",
            {"question": "ajoute une tâche purger la vmc"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.json()["metadata"]["created_entities"] == created


class TestRenameAndDelete:
    def test_rename(self, owner_client, conversation):
        resp = owner_client.patch(
            f"{BASE}{conversation.id}/", {"title": "Nouveau titre"}, format="json"
        )
        assert resp.status_code == status.HTTP_200_OK
        conversation.refresh_from_db()
        assert conversation.title == "Nouveau titre"

    def test_delete_cascades_messages(self, owner_client, conversation):
        AgentMessage.objects.create(
            conversation=conversation, role=AgentMessage.Role.USER, content="q"
        )
        resp = owner_client.delete(f"{BASE}{conversation.id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not AgentConversation.objects.filter(id=conversation.id).exists()
        assert AgentMessage.objects.count() == 0
