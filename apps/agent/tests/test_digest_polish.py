"""
Unit tests for agent.digest.polish — polish_digest.

Covers: returns None when disabled (default), returns None when no API key,
returns None when SDK raises, returns text when fully enabled.
No network calls are made — the Anthropic client is always monkeypatched.
"""
from __future__ import annotations

import pytest

from agent.digest.collectors import DigestSection
from agent.digest.polish import polish_digest
from agent.digest.service import DigestResult


def _result_with_section():
    return DigestResult(
        sections=[DigestSection("tasks", "✅", "Tasks", ["Do the thing"])]
    )


# ---------------------------------------------------------------------------
# polish_digest
# ---------------------------------------------------------------------------

class TestPolishDigest:
    """polish_digest gate checks: disabled flag, missing key, SDK error."""

    def test_returns_none_when_flag_disabled(self, settings):
        settings.DIGEST_AI_POLISH_ENABLED = False
        result = _result_with_section()
        assert polish_digest(result) is None

    def test_returns_none_when_no_api_key(self, settings):
        settings.DIGEST_AI_POLISH_ENABLED = True
        settings.ANTHROPIC_API_KEY = ""
        result = _result_with_section()
        assert polish_digest(result) is None

    def test_returns_none_for_empty_result(self, settings):
        settings.DIGEST_AI_POLISH_ENABLED = True
        settings.ANTHROPIC_API_KEY = "sk-ant-fake"
        result = DigestResult(sections=[])
        assert polish_digest(result) is None

    def test_returns_none_when_sdk_raises(self, settings, monkeypatch):
        settings.DIGEST_AI_POLISH_ENABLED = True
        settings.ANTHROPIC_API_KEY = "sk-ant-fake"

        class _FakeClient:
            class messages:
                @staticmethod
                def create(**kwargs):
                    raise RuntimeError("network error")

        class _FakeAnthropic:
            def __init__(self, **kwargs):
                self.messages = _FakeClient.messages

        import sys
        fake_module = type(sys)("anthropic")
        fake_module.Anthropic = _FakeAnthropic
        monkeypatch.setitem(sys.modules, "anthropic", fake_module)

        result = _result_with_section()
        # Should swallow the exception and return None (best-effort, never blocks send)
        assert polish_digest(result) is None

    def test_returns_text_when_fully_enabled(self, settings, monkeypatch):
        settings.DIGEST_AI_POLISH_ENABLED = True
        settings.ANTHROPIC_API_KEY = "sk-ant-fake"

        import sys

        class _FakeContent:
            text = "Here's your warm digest message."

        class _FakeMessage:
            content = [_FakeContent()]

        class _FakeMessages:
            @staticmethod
            def create(**kwargs):
                return _FakeMessage()

        class _FakeAnthropic:
            def __init__(self, **kwargs):
                self.messages = _FakeMessages()

        fake_module = type(sys)("anthropic")
        fake_module.Anthropic = _FakeAnthropic
        monkeypatch.setitem(sys.modules, "anthropic", fake_module)

        result = _result_with_section()
        polished = polish_digest(result)
        assert polished == "Here's your warm digest message."

    def test_returns_none_when_model_returns_empty_text(self, settings, monkeypatch):
        settings.DIGEST_AI_POLISH_ENABLED = True
        settings.ANTHROPIC_API_KEY = "sk-ant-fake"

        import sys

        class _FakeContent:
            text = "   "  # blank after strip

        class _FakeMessage:
            content = [_FakeContent()]

        class _FakeMessages:
            @staticmethod
            def create(**kwargs):
                return _FakeMessage()

        class _FakeAnthropic:
            def __init__(self, **kwargs):
                self.messages = _FakeMessages()

        fake_module = type(sys)("anthropic")
        fake_module.Anthropic = _FakeAnthropic
        monkeypatch.setitem(sys.modules, "anthropic", fake_module)

        result = _result_with_section()
        assert polish_digest(result) is None
