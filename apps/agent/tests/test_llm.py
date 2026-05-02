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
