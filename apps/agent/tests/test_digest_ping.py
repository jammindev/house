"""
Unit tests for agent.digest.ping — build_daily_digest_message.

Covers: empty digest → None, content digest → rendered text,
user.digest_disabled_sections respected, polish fallback, polish text is escaped.
"""
from __future__ import annotations

from datetime import date
from unittest import mock

import pytest

from agent.digest.collectors import DigestSection
from agent.digest.ping import build_daily_digest_message
from agent.digest.service import DigestResult
from chickens.tests.factories import HouseholdFactory, UserFactory, HouseholdMemberFactory


TODAY = date(2026, 7, 16)


def _make_household_and_user():
    household = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user)
    return household, user


def _noop_build_digest(household, user, *, today, disabled_sections=None):
    return DigestResult(sections=[])


def _section_result(*sections):
    def _build(household, user, *, today, disabled_sections=None):
        return DigestResult(sections=list(sections))
    return _build


@pytest.mark.django_db
class TestBuildDailyDigestMessage:
    """build_daily_digest_message: None when empty; text when content; respects user prefs."""

    def test_empty_digest_returns_none(self, monkeypatch):
        household, user = _make_household_and_user()
        monkeypatch.setattr(
            "agent.digest.ping.build_digest", _noop_build_digest
        )
        result = build_daily_digest_message(household, user, today=TODAY)
        assert result is None

    def test_non_empty_digest_returns_string(self, monkeypatch):
        household, user = _make_household_and_user()
        section = DigestSection("tasks", "✅", "Tasks", ["Today: Fix boiler"])
        monkeypatch.setattr(
            "agent.digest.ping.build_digest",
            _section_result(section),
        )
        monkeypatch.setattr(
            "agent.digest.ping.polish_digest", lambda result: None
        )
        result = build_daily_digest_message(household, user, today=TODAY)
        assert result is not None
        assert isinstance(result, str)
        assert len(result) > 0

    def test_render_telegram_used_when_polish_none(self, monkeypatch):
        household, user = _make_household_and_user()
        section = DigestSection("tasks", "✅", "Tasks", ["Today: Clean sink"])
        monkeypatch.setattr(
            "agent.digest.ping.build_digest",
            _section_result(section),
        )
        monkeypatch.setattr(
            "agent.digest.ping.polish_digest", lambda result: None
        )
        result = build_daily_digest_message(household, user, today=TODAY)
        # render_telegram wraps titles in <b>
        assert "<b>" in result

    def test_polished_text_is_returned_escaped(self, monkeypatch):
        household, user = _make_household_and_user()
        section = DigestSection("tasks", "✅", "Tasks", ["Task"])
        monkeypatch.setattr(
            "agent.digest.ping.build_digest",
            _section_result(section),
        )
        # polish returns raw text (plain, potentially with special chars)
        monkeypatch.setattr(
            "agent.digest.ping.polish_digest",
            lambda result: "All good! Fix <boiler> & have fun.",
        )
        result = build_daily_digest_message(household, user, today=TODAY)
        # The caller html-escapes the polished text
        assert "<boiler>" not in result
        assert "&lt;boiler&gt;" in result
        assert "&amp;" in result

    def test_user_digest_disabled_sections_forwarded(self, monkeypatch):
        household, user = _make_household_and_user()
        user.digest_disabled_sections = ["tasks", "weather"]
        user.save(update_fields=["digest_disabled_sections"])

        captured = {}

        def _spy_build(hh, u, *, today, disabled_sections=None):
            captured["disabled"] = disabled_sections
            return DigestResult(sections=[])

        monkeypatch.setattr("agent.digest.ping.build_digest", _spy_build)
        build_daily_digest_message(household, user, today=TODAY)
        assert set(captured["disabled"]) == {"tasks", "weather"}

    def test_user_with_no_disabled_sections_forwards_empty_list(self, monkeypatch):
        household, user = _make_household_and_user()
        user.digest_disabled_sections = []
        user.save(update_fields=["digest_disabled_sections"])

        captured = {}

        def _spy_build(hh, u, *, today, disabled_sections=None):
            captured["disabled"] = disabled_sections
            return DigestResult(sections=[])

        monkeypatch.setattr("agent.digest.ping.build_digest", _spy_build)
        build_daily_digest_message(household, user, today=TODAY)
        assert captured["disabled"] == []
