"""Tests for the streaming chain: AnthropicClient.run_stream → service.ask_stream → SSE endpoint.

Same philosophy as the rest of the agent suite: no network, the SDK / LLM
client / service layer is faked at the boundary under test.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any
from unittest import mock

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent import service
from agent.llm import AnthropicClient, LLMResponse, LLMRunResponse, LLMTimeoutError, ToolCall
from agent.models import AgentConversation, AgentMessage
from ai_usage.models import AIUsageLog
from households.models import Household, HouseholdMember


# ---------------------------------------------------------------------------
# AnthropicClient.run_stream — fake SDK with a streaming context manager
# ---------------------------------------------------------------------------


class _FakeStream:
    def __init__(self, chunks, final_message, raises=None):
        self.text_stream = iter(chunks)
        self._final = final_message
        self._raises = raises

    def __enter__(self):
        if self._raises:
            raise self._raises
        return self

    def __exit__(self, *args):
        return False

    def get_final_message(self):
        return self._final


class _FakeMessages:
    def __init__(self, stream):
        self._stream = stream
        self.last_kwargs = None

    def stream(self, **kwargs):
        self.last_kwargs = kwargs
        return self._stream


class _FakeSDK:
    def __init__(self, stream):
        self.messages = _FakeMessages(stream)


def _final_message(text="Bonjour", stop_reason="end_turn"):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        stop_reason=stop_reason,
        usage=SimpleNamespace(input_tokens=11, output_tokens=7),
    )


@pytest.fixture
def with_api_key(settings):
    settings.ANTHROPIC_API_KEY = "sk-test-fake"
    return settings


@pytest.fixture
def household(db):
    return Household.objects.create(name="Streaming household")


class TestRunStream:
    def test_yields_deltas_then_final_response(self, with_api_key, monkeypatch, household):
        client = AnthropicClient(model="claude-haiku-4-5")
        fake = _FakeSDK(_FakeStream(["Bon", "jour"], _final_message("Bonjour")))
        monkeypatch.setattr(client, "_client", lambda: fake)

        events = list(
            client.run_stream(
                system="sys",
                messages=[{"role": "user", "content": "salut"}],
                tools=[],
                feature="agent_ask",
                household_id=household.id,
            )
        )

        assert events[:2] == [("delta", "Bon"), ("delta", "jour")]
        kind, response = events[-1]
        assert kind == "final"
        assert isinstance(response, LLMRunResponse)
        assert response.text == "Bonjour"
        assert response.stop_reason == "end_turn"
        assert response.input_tokens == 11

        # One round-trip = one AIUsageLog line, exactly like run().
        log = AIUsageLog.objects.get()
        assert log.success is True
        assert log.input_tokens == 11

    def test_stream_failure_logs_and_raises(self, with_api_key, monkeypatch, household):
        client = AnthropicClient()

        class FakeTimeoutError(Exception):
            pass

        fake = _FakeSDK(_FakeStream([], None, raises=FakeTimeoutError("slow")))
        monkeypatch.setattr(client, "_client", lambda: fake)

        with pytest.raises(LLMTimeoutError):
            list(
                client.run_stream(
                    system="sys",
                    messages=[{"role": "user", "content": "salut"}],
                    tools=[],
                    feature="agent_ask",
                    household_id=household.id,
                )
            )
        log = AIUsageLog.objects.get()
        assert log.success is False

    def test_stream_kwargs_match_run_kwargs(self, with_api_key, monkeypatch, household):
        client = AnthropicClient()
        fake = _FakeSDK(_FakeStream([], _final_message()))
        monkeypatch.setattr(client, "_client", lambda: fake)

        list(
            client.run_stream(
                system="SYSTEM",
                messages=[{"role": "user", "content": "hi"}],
                tools=[{"name": "search_household"}],
                feature="agent_ask",
                household_id=household.id,
            )
        )
        kwargs = fake.messages.last_kwargs
        assert kwargs["system"][0]["cache_control"] == {"type": "ephemeral"}
        assert kwargs["tools"] == [{"name": "search_household"}]


# ---------------------------------------------------------------------------
# service.ask_stream — stub LLM client with run_stream
# ---------------------------------------------------------------------------


def _run_response(text, *, stop_reason="end_turn", tool_calls=None, blocks=None):
    return LLMRunResponse(
        assistant_blocks=blocks or [{"type": "text", "text": text}],
        tool_calls=tool_calls or [],
        text=text,
        stop_reason=stop_reason,
        input_tokens=5,
        output_tokens=7,
        duration_ms=3,
        model="stub-model",
    )


@dataclass
class _StreamingClient:
    """LLMClient stub whose run_stream yields scripted (deltas, final) turns."""

    turns: list[tuple[list[str], LLMRunResponse]] = field(default_factory=list)
    expansion_text: str = ""
    calls: int = 0
    provider: str = "stub"

    def run_stream(self, **kwargs):
        deltas, final = self.turns[min(self.calls, len(self.turns) - 1)]
        self.calls += 1
        for chunk in deltas:
            yield ("delta", chunk)
        yield ("final", final)

    def run(self, **kwargs):  # pragma: no cover — ask_stream prefers run_stream
        raise AssertionError("run() should not be called when run_stream exists")

    def complete(self, **kwargs):
        return LLMResponse(
            text=self.expansion_text, input_tokens=1, output_tokens=1,
            duration_ms=1, model="stub-model",
        )


@pytest.fixture
def owner(db):
    return UserFactory(email="agent-streaming-owner@example.com")


class TestAskStream:
    def test_streams_deltas_then_result(self, with_api_key, household, owner):
        stub = _StreamingClient(turns=[(["Bon", "jour !"], _run_response("Bonjour !"))])
        events = list(service.ask_stream("bonjour", household, user=owner, client=stub))

        assert [e for e in events if e["type"] == "delta"] == [
            {"type": "delta", "text": "Bon"},
            {"type": "delta", "text": "jour !"},
        ]
        result = events[-1]
        assert result["type"] == "result"
        assert result["result"].answer == "Bonjour !"

    def test_tool_calls_emit_tool_events(self, with_api_key, household, owner):
        call = ToolCall(id="t1", name="search_household", input={"query": "chaudière"})
        tool_turn = _run_response(
            "",
            stop_reason="tool_use",
            tool_calls=[call],
            blocks=[{"type": "tool_use", "id": "t1", "name": "search_household",
                     "input": {"query": "chaudière"}}],
        )
        stub = _StreamingClient(
            turns=[([], tool_turn), (["Rien trouvé."], _run_response("Rien trouvé."))]
        )
        events = list(service.ask_stream("la chaudière ?", household, user=owner, client=stub))

        assert {"type": "tool", "name": "search_household"} in events
        assert events[-1]["result"].metadata["tool_calls"] == 1

    def test_ask_returns_same_result_as_drained_stream(self, with_api_key, household, owner):
        stub = _StreamingClient(turns=[(["Salut"], _run_response("Salut"))])
        result = service.ask("bonjour", household, user=owner, client=stub)
        assert result.answer == "Salut"

    def test_empty_question_yields_result_only(self, with_api_key, household, owner):
        events = list(service.ask_stream("  ", household, user=owner))
        assert len(events) == 1
        assert events[0]["type"] == "result"


# ---------------------------------------------------------------------------
# SSE endpoint — POST /conversations/{id}/messages/stream/
# ---------------------------------------------------------------------------


BASE = "/api/agent/conversations/"


@pytest.fixture
def member_household(db, owner):
    h = Household.objects.create(name="SSE House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    owner.active_household = h
    owner.save(update_fields=["active_household"])
    return h


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


@pytest.fixture
def conversation(member_household, owner):
    return AgentConversation.objects.create(household=member_household, created_by=owner)


def _answer(text="ok"):
    return service.AnswerResult(answer=text, citations=[], metadata={"model": "m"})


def _sse_frames(resp) -> list[tuple[str, str]]:
    """Parse the streamed body into (event, data) pairs."""
    body = b"".join(resp.streaming_content).decode()
    frames = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.split("\n"))
        frames.append((lines["event"], lines["data"]))
    return frames


class TestStreamEndpoint:
    def test_streams_deltas_tools_and_done(self, owner_client, conversation, monkeypatch):
        def fake_ask_stream(*args, **kwargs):
            yield {"type": "delta", "text": "Bon"}
            yield {"type": "tool", "name": "search_household"}
            yield {"type": "delta", "text": "jour"}
            yield {"type": "result", "result": _answer("Bonjour")}

        monkeypatch.setattr("agent.views.service.ask_stream", fake_ask_stream)

        resp = owner_client.post(
            f"{BASE}{conversation.id}/messages/stream/", {"question": "salut"}, format="json"
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp["Content-Type"] == "text/event-stream"
        assert resp["X-Accel-Buffering"] == "no"

        frames = _sse_frames(resp)
        assert frames[0] == ("delta", '{"text": "Bon"}')
        assert frames[1] == ("tool", '{"name": "search_household"}')
        assert frames[-1][0] == "done"
        assert '"content": "Bonjour"' in frames[-1][1]

        # Both turns persisted, like the non-streaming endpoint.
        roles = list(conversation.messages.values_list("role", "content"))
        assert roles == [("user", "salut"), ("agent", "Bonjour")]

    def test_llm_error_emits_error_event_and_persists_nothing(
        self, owner_client, conversation, monkeypatch
    ):
        def failing_stream(*args, **kwargs):
            yield {"type": "delta", "text": "Bon"}
            raise service.LLMError("boom")

        monkeypatch.setattr("agent.views.service.ask_stream", failing_stream)

        resp = owner_client.post(
            f"{BASE}{conversation.id}/messages/stream/", {"question": "salut"}, format="json"
        )
        frames = _sse_frames(resp)
        assert frames[-1] == ("error", '{"detail": "unavailable"}')
        assert conversation.messages.count() == 0

    def test_unexpected_error_emits_generic_error(self, owner_client, conversation, monkeypatch):
        def exploding_stream(*args, **kwargs):
            raise RuntimeError("nope")
            yield  # pragma: no cover — make it a generator

        monkeypatch.setattr("agent.views.service.ask_stream", exploding_stream)

        resp = owner_client.post(
            f"{BASE}{conversation.id}/messages/stream/", {"question": "salut"}, format="json"
        )
        assert _sse_frames(resp)[-1] == ("error", '{"detail": "error"}')

    def test_cannot_stream_another_users_conversation(self, owner_client, member_household):
        other = UserFactory(email="sse-other@example.com")
        HouseholdMember.objects.create(
            user=other, household=member_household, role=HouseholdMember.Role.MEMBER
        )
        theirs = AgentConversation.objects.create(
            household=member_household, created_by=other
        )
        resp = owner_client.post(
            f"{BASE}{theirs.id}/messages/stream/", {"question": "x"}, format="json"
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_stream_action_is_throttled(self, owner_client, conversation, monkeypatch):
        from django.core.cache import cache
        from agent.throttles import AgentBurstRateThrottle

        cache.clear()
        monkeypatch.setattr(AgentBurstRateThrottle, "rate", "1/min", raising=False)

        def fake_ask_stream(*args, **kwargs):
            yield {"type": "result", "result": _answer()}

        monkeypatch.setattr("agent.views.service.ask_stream", fake_ask_stream)

        url = f"{BASE}{conversation.id}/messages/stream/"
        first = owner_client.post(url, {"question": "q"}, format="json")
        assert first.status_code == status.HTTP_200_OK
        list(first.streaming_content)  # drain
        second = owner_client.post(url, {"question": "q"}, format="json")
        assert second.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        cache.clear()
