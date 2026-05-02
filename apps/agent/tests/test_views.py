"""Tests for the POST /api/agent/ask/ endpoint."""
from __future__ import annotations

from unittest import mock

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent import service
from agent.llm import LLMError, LLMTimeoutError
from households.models import Household, HouseholdMember


URL = "/api/agent/ask/"


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def owner(db):
    return UserFactory(email="agent-views-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Views House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    owner.active_household = h
    owner.save(update_fields=["active_household"])
    return h


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


def _patch_ask(monkeypatch, return_value=None, side_effect=None):
    fake = mock.Mock(return_value=return_value, side_effect=side_effect)
    monkeypatch.setattr("agent.views.service.ask", fake)
    return fake


class TestAuth:
    def test_anonymous_is_rejected(self):
        client = APIClient()
        resp = client.post(URL, {"question": "engie?"}, format="json")
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


class TestValidation:
    def test_empty_body_rejected(self, owner_client, household):
        resp = owner_client.post(URL, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_blank_question_rejected(self, owner_client, household):
        resp = owner_client.post(URL, {"question": "   "}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_question_too_long_rejected(self, owner_client, household):
        resp = owner_client.post(URL, {"question": "x" * 5000}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


class TestHappyPath:
    def test_returns_answer_with_citations(self, owner_client, household, monkeypatch):
        result = service.AnswerResult(
            answer='Tu as payé 142€ <cite id="document:abc"/>.',
            citations=[
                service.Citation(
                    entity_type="document",
                    id="abc",
                    label="Engie facture mars",
                    snippet="total 142 EUR",
                    url_path="/app/documents/abc",
                ),
            ],
            metadata={"duration_ms": 12, "tokens_in": 1, "tokens_out": 2, "model": "m", "hits_count": 1},
        )
        ask_mock = _patch_ask(monkeypatch, return_value=result)

        resp = owner_client.post(URL, {"question": "engie?"}, format="json")

        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert "Engie" not in body["answer"] or "Tu as payé" in body["answer"]
        assert body["citations"][0]["entity_type"] == "document"
        assert body["citations"][0]["id"] == "abc"
        assert body["citations"][0]["label"] == "Engie facture mars"
        assert body["citations"][0]["url_path"] == "/app/documents/abc"
        assert body["metadata"]["model"] == "m"

        # service.ask was called with the right household
        called_household = ask_mock.call_args.args[1]
        assert called_household.id == household.id


class TestErrorPaths:
    def test_timeout_returns_504(self, owner_client, household, monkeypatch):
        _patch_ask(monkeypatch, side_effect=LLMTimeoutError("timed out"))
        resp = owner_client.post(URL, {"question": "x"}, format="json")
        assert resp.status_code == status.HTTP_504_GATEWAY_TIMEOUT

    def test_llm_error_returns_503(self, owner_client, household, monkeypatch):
        _patch_ask(monkeypatch, side_effect=LLMError("boom"))
        resp = owner_client.post(URL, {"question": "x"}, format="json")
        assert resp.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


class TestHouseholdResolution:
    def test_user_with_no_household_gets_400(self, db, monkeypatch):
        user = UserFactory(email="loner@example.com")
        client = _client_for(user)
        _patch_ask(monkeypatch)
        resp = client.post(URL, {"question": "engie?"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
