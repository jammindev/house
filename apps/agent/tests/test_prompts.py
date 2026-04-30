"""Tests for the agent prompts module."""
from __future__ import annotations

from agent.prompts import SYSTEM_PROMPT, build_user_prompt
from agent.retrieval import Hit


def _hit(**overrides) -> Hit:
    payload = dict(
        entity_type="document",
        id="abc-123",
        label="Facture Engie mars",
        snippet="total 142,67 EUR",
        rank=0.91,
        url_path="/app/documents/abc-123",
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
