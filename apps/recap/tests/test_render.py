# recap/tests/test_render.py
"""
Tests for recap.render — the deterministic, localized fallback.

The two invariants worth a permanent test: an **unknown card kind** and a
**missing key** must degrade, never raise. A frozen snapshot is a public format
written by possibly-older code, and it has to stay readable forever.
"""
from __future__ import annotations

import pytest
from django.utils import translation

from recap.render import render_card, render_chapters


def _snapshot(cards, key="money"):
    return {"month": "2026-07", "chapters": [{"key": key, "cards": cards}]}


class TestUnknownAndMalformedInput:
    def test_an_unknown_card_kind_is_skipped_silently(self):
        assert render_card({"kind": "quantum_flux", "value": "42"}) is None

    def test_a_snapshot_of_only_unknown_kinds_renders_as_no_chapter(self):
        """A month frozen by a *newer* version, read by this one: no crash, no chapter."""
        out = render_chapters(_snapshot([{"kind": "from_the_future", "value": "1"}]))
        assert out == []

    def test_a_card_that_is_not_a_dict_is_skipped(self):
        assert render_card("not a card") is None  # type: ignore[arg-type]

    def test_an_empty_snapshot_renders_as_an_empty_list(self):
        assert render_chapters({}) == []
        assert render_chapters({"chapters": []}) == []

    def test_a_missing_value_degrades_to_zero_rather_than_raising(self):
        card = render_card({"kind": "total_spent"})
        assert card is not None
        assert card["value"] == "0.00"

    def test_a_garbage_amount_degrades_to_zero(self):
        card = render_card({"kind": "total_spent", "value": "not-a-number"})
        assert card is not None
        assert card["value"] == "0.00"


class TestTheMoneyCards:
    def test_the_total_keeps_its_raw_amount_for_the_client_to_format(self):
        """``value_type='money'`` → the front formats with ``formatAmount``, so the
        backend must not bake a currency symbol into the payload."""
        card = render_card({"kind": "total_spent", "value": "1240.50", "expense_count": 24})
        assert card["value"] == "1240.50"
        assert card["value_type"] == "money"
        assert "€" not in card["value"]

    @pytest.mark.parametrize(
        "trend,expected",
        [(-12.4, "less"), (18.0, "more"), (0, "as much")],
    )
    def test_the_trend_is_told_in_the_right_direction(self, trend, expected):
        with translation.override("en"):
            card = render_card(
                {"kind": "total_spent", "value": "100.00", "expense_count": 2, "trend_pct": trend}
            )
        assert expected in card["caption"].lower()

    def test_without_a_previous_month_the_caption_falls_back_to_the_count(self):
        with translation.override("en"):
            card = render_card(
                {"kind": "total_spent", "value": "100.00", "expense_count": 3, "trend_pct": None}
            )
        assert "3" in card["caption"]

    def test_an_uncapped_category_is_never_counted_as_held(self):
        """A category without a ceiling can be neither respected nor exceeded — a
        green tick on what has no scale is the same lie as a validated empty check."""
        with translation.override("en"):
            card = render_card(
                {
                    "kind": "budget_outcome",
                    "total": 1,
                    "kept": 0,
                    "over_count": 0,
                    "over_names": [],
                    "uncapped_count": 1,
                }
            )
        assert "ceiling" in card["caption"].lower()

    def test_an_exceeded_budget_is_named(self):
        with translation.override("en"):
            card = render_card(
                {
                    "kind": "budget_outcome",
                    "total": 3,
                    "kept": 2,
                    "over_count": 1,
                    "over_names": ["Courses"],
                    "uncapped_count": 0,
                }
            )
        assert "Courses" in card["caption"]
        assert card["value"] == "2/3"

    def test_a_budget_card_without_budgets_is_dropped(self):
        assert render_card({"kind": "budget_outcome", "total": 0}) is None

    def test_a_biggest_expense_without_a_subject_is_dropped(self):
        assert render_card({"kind": "biggest_expense", "subject": "  ", "value": "10"}) is None

    def test_the_subject_of_the_biggest_expense_is_never_translated(self):
        """It is a proper noun the user typed — it travels through untouched."""
        card = render_card({"kind": "biggest_expense", "subject": "Leroy Merlin", "value": "150"})
        assert card["headline"] == "Leroy Merlin"


class TestLocalization:
    def test_the_template_renders_in_all_four_languages_without_network(self):
        cards = [{"kind": "total_spent", "value": "100.00", "expense_count": 2, "trend_pct": -5.0}]
        for lang in ("en", "fr", "de", "es"):
            with translation.override(lang):
                out = render_chapters(_snapshot(cards))
            assert out and out[0]["cards"][0]["caption"]

    def test_two_renders_in_the_same_language_are_identical(self):
        cards = [{"kind": "total_spent", "value": "100.00", "expense_count": 2}]
        with translation.override("en"):
            first = render_chapters(_snapshot(cards))
            second = render_chapters(_snapshot(cards))
        assert first == second

    def test_an_unknown_chapter_key_still_shows_its_cards(self):
        """A chapter added by a newer version keeps its cards, just without a title."""
        out = render_chapters(
            _snapshot([{"kind": "total_spent", "value": "10.00"}], key="mystery")
        )
        assert len(out) == 1
        assert out[0]["title"] == ""
        assert out[0]["cards"]
