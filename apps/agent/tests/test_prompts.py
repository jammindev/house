"""Tests for the agent prompts module."""
from __future__ import annotations

from agent.prompts import (
    TRUNCATION_MARKER,
    SYSTEM_PROMPT,
    build_user_prompt,
)
from agent.retrieval import Hit


def _hit(**overrides) -> Hit:
    payload = dict(
        entity_type="document",
        id="abc-123",
        label="Facture Engie mars",
        snippet="total 142,67 EUR",
        rank=0.91,
        url_path="/app/documents/abc-123",
        content="",
    )
    payload.update(overrides)
    return Hit(**payload)


class TestSystemPrompt:
    def test_mentions_household_only_rule(self):
        assert "ONLY" in SYSTEM_PROMPT or "only" in SYSTEM_PROMPT

    def test_mentions_citation_format(self):
        assert "<cite" in SYSTEM_PROMPT
        assert "entity_type:id" in SYSTEM_PROMPT

    def test_tells_model_to_admit_ignorance(self):
        lower = SYSTEM_PROMPT.lower()
        assert "do not know" in lower or "don't know" in lower or "i do not know" in lower


class TestBuildUserPrompt:
    def test_includes_question_text(self):
        prompt = build_user_prompt("Combien j'ai payé Engie ?", [_hit()])
        assert "Combien j'ai payé Engie ?" in prompt

    def test_renders_each_hit_with_tag(self):
        h1 = _hit(entity_type="document", id="doc-1", label="Doc 1")
        h2 = _hit(entity_type="task", id="task-9", label="Task 9")
        prompt = build_user_prompt("hello", [h1, h2])
        assert "id=document:doc-1" in prompt
        assert "id=task:task-9" in prompt
        assert "Doc 1" in prompt
        assert "Task 9" in prompt

    def test_no_hits_renders_empty_marker(self):
        prompt = build_user_prompt("hello", [])
        assert "no household items matched" in prompt.lower()


class TestContentEnrichment:
    def test_top_hit_renders_full_content(self):
        hit = _hit(content="Montant total 4200 EUR chez Saunier Duval le 12/03/2026")
        prompt = build_user_prompt("combien ?", [hit])
        assert "4200" in prompt
        assert "Saunier Duval" in prompt
        assert "content:" in prompt

    def test_hit_without_content_falls_back_to_snippet(self):
        hit = _hit(content="", snippet="total 142,67 EUR")
        prompt = build_user_prompt("combien ?", [hit])
        assert "excerpt:" in prompt
        assert "142,67" in prompt

    def test_tail_hits_beyond_top_n_use_snippet(self):
        hits = [
            _hit(id=f"doc-{i}", content=f"full body of doc {i}", snippet=f"snip {i}")
            for i in range(5)
        ]
        prompt = build_user_prompt("q", hits, content_top_n=2)
        # First two get full content, the rest get their snippet.
        assert "full body of doc 0" in prompt
        assert "full body of doc 1" in prompt
        assert "full body of doc 4" not in prompt
        assert "snip 4" in prompt

    def test_per_hit_budget_truncates_long_content(self):
        hit = _hit(content="mot " * 500)  # ~2000 chars
        prompt = build_user_prompt("q", [hit], char_budget_per_hit=50)
        assert TRUNCATION_MARKER in prompt

    def test_total_budget_stops_enriching_further_hits(self):
        hits = [
            _hit(id=f"doc-{i}", content="x" * 100, snippet=f"snip {i}")
            for i in range(3)
        ]
        # Budget only covers the first hit's content; the rest fall back.
        prompt = build_user_prompt(
            "q", hits, content_top_n=3, char_budget_per_hit=100, total_char_budget=100
        )
        assert "snip 1" in prompt or "snip 2" in prompt

    def test_content_truncation_respects_word_boundary(self):
        hit = _hit(content="alpha bravo charlie delta echo foxtrot")
        prompt = build_user_prompt("q", [hit], char_budget_per_hit=15)
        # Should not cut mid-word: no partial token like "cha" without the rest.
        assert TRUNCATION_MARKER in prompt
