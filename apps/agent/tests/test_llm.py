"""Tests for the LLM client wrapper.

We never hit the real Anthropic API — every call goes through a fake SDK client
patched onto ``AnthropicClient._client``. This guarantees zero network in CI
and lets us exercise the timeout / error code paths.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from accounts.tests.factories import UserFactory
from agent.llm import (
    AnthropicClient,
    LLMError,
    LLMTimeoutError,
    get_llm_client,
)
from ai_usage.models import AIUsageLog
from households.models import Household


@pytest.fixture
def with_api_key(settings):
    settings.ANTHROPIC_API_KEY = "sk-test-fake"
    return settings


def _fake_message(text: str = "hello", input_tokens: int = 10, output_tokens: int = 5):
    return SimpleNamespace(
        content=[SimpleNamespace(text=text)],
        usage=SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens),
    )


class _FakeMessages:
    def __init__(self, response=None, raises: Exception | None = None):
        self.response = response
        self.raises = raises
        self.last_kwargs = None

    def create(self, **kwargs):
        self.last_kwargs = kwargs
        if self.raises:
            raise self.raises
        return self.response or _fake_message()


class _FakeClient:
    def __init__(self, response=None, raises: Exception | None = None):
        self.messages = _FakeMessages(response=response, raises=raises)


@pytest.fixture
def household(db):
    return Household.objects.create(name="LLM test household")


@pytest.fixture
def user(db):
    return UserFactory(email="llm-test@example.com")


class TestAnthropicClientHappyPath:
    def test_complete_returns_text_and_logs_usage(self, with_api_key, monkeypatch, household, user):
        client = AnthropicClient(model="claude-haiku-4-5")
        fake = _FakeClient(response=_fake_message("Bonjour Engie", 17, 4))
        monkeypatch.setattr(client, "_client", lambda: fake)

        result = client.complete(
            system="sys",
            user="hello",
            feature="agent_ask",
            household_id=household.id,
            user_id=user.id,
        )

        assert result.text == "Bonjour Engie"
        assert result.input_tokens == 17
        assert result.output_tokens == 4
        assert result.duration_ms >= 0
        assert result.model == "claude-haiku-4-5"

        log = AIUsageLog.objects.get()
        assert log.feature == "agent_ask"
        assert log.provider == "anthropic"
        assert log.model == "claude-haiku-4-5"
        assert log.success is True
        assert log.input_tokens == 17
        assert log.output_tokens == 4
        assert log.user_id == user.id
        assert log.household_id == household.id

    def test_complete_passes_system_and_user_to_sdk(self, with_api_key, monkeypatch, household):
        client = AnthropicClient()
        fake = _FakeClient(response=_fake_message("ok"))
        monkeypatch.setattr(client, "_client", lambda: fake)

        client.complete(
            system="SYSTEM",
            user="USER",
            feature="agent_ask",
            household_id=household.id,
        )

        assert fake.messages.last_kwargs["system"] == "SYSTEM"
        assert fake.messages.last_kwargs["messages"] == [{"role": "user", "content": "USER"}]


def _text_block(text: str):
    return SimpleNamespace(type="text", text=text)


def _tool_use_block(block_id: str, name: str, tool_input: dict):
    return SimpleNamespace(type="tool_use", id=block_id, name=name, input=tool_input)


def _fake_run_message(content, stop_reason="end_turn", input_tokens=10, output_tokens=5):
    return SimpleNamespace(
        content=content,
        stop_reason=stop_reason,
        usage=SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens),
    )


class TestAnthropicClientRun:
    def test_run_returns_final_text_and_logs_usage(self, with_api_key, monkeypatch, household, user):
        client = AnthropicClient(model="claude-haiku-4-5")
        fake = _FakeClient(
            response=_fake_run_message([_text_block("Bonjour")], "end_turn", 21, 3)
        )
        monkeypatch.setattr(client, "_client", lambda: fake)

        result = client.run(
            system="sys",
            messages=[{"role": "user", "content": "hello"}],
            tools=[{"name": "search_household"}],
            feature="agent_ask",
            household_id=household.id,
            user_id=user.id,
        )

        assert result.text == "Bonjour"
        assert result.stop_reason == "end_turn"
        assert result.tool_calls == []
        assert result.assistant_blocks == [{"type": "text", "text": "Bonjour"}]
        assert result.input_tokens == 21
        assert result.output_tokens == 3
        assert result.model == "claude-haiku-4-5"

        log = AIUsageLog.objects.get()
        assert log.feature == "agent_ask"
        assert log.success is True
        assert log.input_tokens == 21
        assert log.output_tokens == 3

    def test_run_extracts_tool_calls_and_normalizes_blocks(self, with_api_key, monkeypatch, household):
        client = AnthropicClient()
        content = [
            _text_block("Je cherche."),
            _tool_use_block("toolu_1", "search_household", {"query": "chaudière"}),
        ]
        fake = _FakeClient(response=_fake_run_message(content, "tool_use"))
        monkeypatch.setattr(client, "_client", lambda: fake)

        result = client.run(
            system="sys",
            messages=[{"role": "user", "content": "quand a-t-on changé la chaudière ?"}],
            tools=[{"name": "search_household"}],
            feature="agent_ask",
            household_id=household.id,
        )

        assert result.stop_reason == "tool_use"
        assert len(result.tool_calls) == 1
        call = result.tool_calls[0]
        assert call.id == "toolu_1"
        assert call.name == "search_household"
        assert call.input == {"query": "chaudière"}
        assert result.assistant_blocks == [
            {"type": "text", "text": "Je cherche."},
            {
                "type": "tool_use",
                "id": "toolu_1",
                "name": "search_household",
                "input": {"query": "chaudière"},
            },
        ]

    def test_run_passes_messages_and_tools_to_sdk(self, with_api_key, monkeypatch, household):
        client = AnthropicClient()
        fake = _FakeClient(response=_fake_run_message([_text_block("ok")]))
        monkeypatch.setattr(client, "_client", lambda: fake)

        messages = [{"role": "user", "content": "hi"}]
        tools = [{"name": "search_household", "input_schema": {}}]
        client.run(
            system="SYSTEM",
            messages=messages,
            tools=tools,
            feature="agent_ask",
            household_id=household.id,
        )

        assert fake.messages.last_kwargs["system"] == "SYSTEM"
        assert fake.messages.last_kwargs["messages"] == messages
        assert fake.messages.last_kwargs["tools"] == tools

    def test_run_omits_tools_kwarg_when_no_tools(self, with_api_key, monkeypatch, household):
        client = AnthropicClient()
        fake = _FakeClient(response=_fake_run_message([_text_block("ok")]))
        monkeypatch.setattr(client, "_client", lambda: fake)

        client.run(
            system="sys",
            messages=[{"role": "user", "content": "hi"}],
            tools=[],
            feature="agent_ask",
            household_id=household.id,
        )

        assert "tools" not in fake.messages.last_kwargs

    def test_run_timeout_raises_and_logs_failure(self, with_api_key, monkeypatch, household):
        client = AnthropicClient()

        class FakeTimeoutError(Exception):
            pass

        FakeTimeoutError.__name__ = "APITimeoutError"
        monkeypatch.setattr(
            client, "_client", lambda: _FakeClient(raises=FakeTimeoutError("timed out"))
        )

        with pytest.raises(LLMTimeoutError):
            client.run(
                system="sys",
                messages=[{"role": "user", "content": "hi"}],
                tools=[],
                feature="agent_ask",
                household_id=household.id,
            )

        log = AIUsageLog.objects.get()
        assert log.success is False
        assert log.error_type == "timeout"


class TestAnthropicClientErrorPaths:
    def test_timeout_raises_llmtimeouterror_and_logs_failure(self, with_api_key, monkeypatch, household):
        client = AnthropicClient()

        class FakeTimeoutError(Exception):
            pass

        FakeTimeoutError.__name__ = "APITimeoutError"
        monkeypatch.setattr(
            client, "_client", lambda: _FakeClient(raises=FakeTimeoutError("timed out"))
        )

        with pytest.raises(LLMTimeoutError):
            client.complete(
                system="sys",
                user="hello",
                feature="agent_ask",
                household_id=household.id,
            )

        log = AIUsageLog.objects.get()
        assert log.success is False
        assert log.error_type == "timeout"

    def test_other_error_raises_llmerror_and_logs_failure(self, with_api_key, monkeypatch, household):
        client = AnthropicClient()
        monkeypatch.setattr(
            client, "_client", lambda: _FakeClient(raises=RuntimeError("boom"))
        )

        with pytest.raises(LLMError):
            client.complete(
                system="sys",
                user="hello",
                feature="agent_ask",
                household_id=household.id,
            )

        log = AIUsageLog.objects.get()
        assert log.success is False
        assert log.error_type  # at least populated


class TestNoApiKey:
    def test_complete_raises_llmerror_when_key_missing(self, settings, household):
        settings.ANTHROPIC_API_KEY = ""
        client = AnthropicClient()
        with pytest.raises(LLMError):
            client.complete(
                system="sys",
                user="hello",
                feature="agent_ask",
                household_id=household.id,
            )


class TestFactory:
    def test_default_returns_anthropic_client(self, settings):
        settings.LLM_PROVIDER = "anthropic"
        assert isinstance(get_llm_client(), AnthropicClient)

    def test_explicit_override_wins(self, settings):
        settings.LLM_PROVIDER = "something-else"
        assert isinstance(get_llm_client(provider="anthropic"), AnthropicClient)

    def test_unknown_provider_raises(self):
        with pytest.raises(LLMError):
            get_llm_client(provider="ollama")
