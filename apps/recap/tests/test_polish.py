# recap/tests/test_polish.py
"""
Tests for recap.polish + the memoization in recap.service.

The rule under test: **the deterministic template always leaves, the AI can never
block.** Every failure mode returns ``None`` rather than raising, and a successful
polish costs at most one call per month and per language.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings

from recap.models import HouseholdRecap
from recap.polish import polish_captions
from recap.service import render_recap

from .factories import HouseholdFactory

CHAPTERS = [
    {
        "key": "money",
        "cards": [
            {"kind": "total_spent", "caption": "That's 12% less than the month before."},
            {"kind": "biggest_expense", "caption": "Your biggest expense of the month."},
        ],
    }
]


def _snapshot_stats():
    return {
        "month": "2026-07",
        "generated_for": ["money"],
        "chapters": [
            {
                "key": "money",
                "cards": [
                    {"kind": "total_spent", "value": "100.00", "expense_count": 2, "trend_pct": -12.0},
                    {"kind": "biggest_expense", "subject": "Plumber", "value": "80.00"},
                ],
            }
        ],
        "card_count": 2,
    }


def _reply(text: str):
    message = MagicMock()
    block = MagicMock()
    block.text = text
    message.content = [block]
    client = MagicMock()
    client.messages.create.return_value = message
    return client


class TestPolishIsNeverRequired:
    def test_disabled_by_setting_returns_none(self):
        with override_settings(RECAP_AI_POLISH_ENABLED=False):
            assert polish_captions(CHAPTERS) is None

    def test_no_api_key_returns_none(self):
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY=""):
            assert polish_captions(CHAPTERS) is None

    def test_no_captions_returns_none(self):
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            assert polish_captions([]) is None

    def test_a_network_error_returns_none_instead_of_raising(self):
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            client = MagicMock()
            client.messages.create.side_effect = RuntimeError("timeout")
            with patch("anthropic.Anthropic", return_value=client):
                assert polish_captions(CHAPTERS) is None

    def test_non_json_reply_returns_none(self):
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            with patch("anthropic.Anthropic", return_value=_reply("Sure! Here you go.")):
                assert polish_captions(CHAPTERS) is None

    def test_a_reply_missing_a_key_is_refused_wholesale(self):
        """Half-applied captions read worse than none at all."""
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            reply = _reply('{"total_spent": "Nicely done."}')
            with patch("anthropic.Anthropic", return_value=reply):
                assert polish_captions(CHAPTERS) is None

    def test_a_reply_with_an_extra_key_is_refused(self):
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            reply = _reply(
                '{"total_spent": "a", "biggest_expense": "b", "invented": "c"}'
            )
            with patch("anthropic.Anthropic", return_value=reply):
                assert polish_captions(CHAPTERS) is None

    def test_a_blank_caption_is_refused(self):
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            reply = _reply('{"total_spent": "  ", "biggest_expense": "b"}')
            with patch("anthropic.Anthropic", return_value=reply):
                assert polish_captions(CHAPTERS) is None

    def test_a_valid_reply_is_accepted(self):
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            reply = _reply('{"total_spent": "Lighter month!", "biggest_expense": "Ouch."}')
            with patch("anthropic.Anthropic", return_value=reply):
                out = polish_captions(CHAPTERS)
        assert out == {"total_spent": "Lighter month!", "biggest_expense": "Ouch."}

    def test_a_fenced_json_block_is_tolerated(self):
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            reply = _reply('```json\n{"total_spent": "a", "biggest_expense": "b"}\n```')
            with patch("anthropic.Anthropic", return_value=reply):
                out = polish_captions(CHAPTERS)
        assert out == {"total_spent": "a", "biggest_expense": "b"}


@pytest.mark.django_db
class TestMemoization:
    def _recap(self):
        return HouseholdRecap.objects.create(
            household=HouseholdFactory(), month="2026-07", stats=_snapshot_stats()
        )

    def test_a_second_render_in_the_same_language_costs_no_call(self):
        recap = self._recap()
        reply = _reply('{"total_spent": "Lighter month!", "biggest_expense": "Ouch."}')
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            with patch("anthropic.Anthropic", return_value=reply) as factory:
                render_recap(recap, lang="en", polish=True)
                render_recap(recap, lang="en", polish=True)

        assert factory.call_count == 1
        assert "en" in recap.stats["_polished"]

    def test_a_second_language_costs_its_own_call(self):
        recap = self._recap()
        reply = _reply('{"total_spent": "a", "biggest_expense": "b"}')
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            with patch("anthropic.Anthropic", return_value=reply) as factory:
                render_recap(recap, lang="en", polish=True)
                render_recap(recap, lang="fr", polish=True)

        assert factory.call_count == 2
        assert set(recap.stats["_polished"]) == {"en", "fr"}

    def test_the_polished_caption_replaces_only_the_caption(self):
        recap = self._recap()
        reply = _reply('{"total_spent": "Lighter month!", "biggest_expense": "Ouch."}')
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            with patch("anthropic.Anthropic", return_value=reply):
                chapters = render_recap(recap, lang="en", polish=True)

        card = chapters[0]["cards"][0]
        assert card["caption"] == "Lighter month!"
        assert card["value"] == "100.00"  # the figure is untouched

    def test_polish_off_returns_the_deterministic_text_and_writes_no_cache(self):
        recap = self._recap()
        chapters = render_recap(recap, lang="en", polish=False)
        assert chapters[0]["cards"][0]["caption"]
        assert "_polished" not in (recap.stats or {})

    def test_a_failing_polish_still_returns_the_deterministic_chapters(self):
        recap = self._recap()
        with override_settings(RECAP_AI_POLISH_ENABLED=True, ANTHROPIC_API_KEY="k"):
            client = MagicMock()
            client.messages.create.side_effect = RuntimeError("boom")
            with patch("anthropic.Anthropic", return_value=client):
                chapters = render_recap(recap, lang="en", polish=True)

        assert chapters[0]["cards"][0]["caption"]


@pytest.mark.django_db
class TestDisabledChaptersAreAReadPreference:
    def test_a_disabled_chapter_disappears_from_the_rendering_but_stays_frozen(self):
        recap = HouseholdRecap.objects.create(
            household=HouseholdFactory(), month="2026-07", stats=_snapshot_stats()
        )

        chapters = render_recap(recap, lang="en", polish=False, disabled_chapters=["money"])

        assert chapters == []
        assert recap.stats["generated_for"] == ["money"]  # the snapshot is untouched
