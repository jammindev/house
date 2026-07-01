"""Tests for agent.query_expansion.

No network: the LLM client is a deterministic stub for every test.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from agent import query_expansion
from agent.llm import LLMError, LLMResponse, LLMTimeoutError


@dataclass
class _StubLLMClient:
    """LLMClient drop-in. Returns canned text (or raises), records the last call."""

    text: str = ""
    raises: Exception | None = None
    last_call: dict[str, Any] | None = None
    provider: str = "stub"

    def complete(self, **kwargs):
        self.last_call = kwargs
        if self.raises:
            raise self.raises
        return LLMResponse(
            text=self.text,
            input_tokens=1,
            output_tokens=1,
            duration_ms=1,
            model="stub-model",
        )


HH = "00000000-0000-0000-0000-000000000001"


class TestExpandHappyPath:
    def test_returns_original_plus_keywords(self):
        stub = _StubLLMClient(text="pompe à chaleur, PAC, Daikin, facture")
        terms = query_expansion.expand(
            "trouve-moi la facture de la pompe à chaleur",
            client=stub,
            household_id=HH,
        )
        assert terms[0] == "trouve-moi la facture de la pompe à chaleur"
        assert "PAC" in terms
        assert "Daikin" in terms
        assert "pompe à chaleur" in terms

    def test_original_is_always_first_even_when_repeated_by_model(self):
        stub = _StubLLMClient(text="engie, facture")
        terms = query_expansion.expand("engie", client=stub, household_id=HH)
        assert terms[0] == "engie"
        # case-insensitive dedupe keeps the first occurrence only
        assert sum(1 for t in terms if t.casefold() == "engie") == 1

    def test_uses_distinct_feature_name_for_usage_log(self):
        stub = _StubLLMClient(text="a, b")
        query_expansion.expand("question", client=stub, household_id=HH, user_id=7)
        assert stub.last_call is not None
        assert stub.last_call["feature"] == query_expansion.FEATURE_NAME
        assert stub.last_call["feature"] != "agent_ask"
        assert stub.last_call["household_id"] == HH
        assert stub.last_call["user_id"] == 7

    def test_only_the_question_is_sent_to_the_model(self):
        stub = _StubLLMClient(text="a, b")
        query_expansion.expand("où est la clé ?", client=stub, household_id=HH)
        assert stub.last_call["user"] == "où est la clé ?"


class TestExpandParsing:
    def test_parses_json_array(self):
        stub = _StubLLMClient(text='["pompe à chaleur", "PAC"]')
        terms = query_expansion.expand("q", client=stub, household_id=HH)
        assert "pompe à chaleur" in terms
        assert "PAC" in terms

    def test_parses_newlines_and_bullets(self):
        stub = _StubLLMClient(text="- pompe à chaleur\n- PAC\n- Daikin")
        terms = query_expansion.expand("q", client=stub, household_id=HH)
        assert "pompe à chaleur" in terms
        assert "PAC" in terms
        assert "Daikin" in terms

    def test_drops_tiny_tokens(self):
        stub = _StubLLMClient(text="a, PAC, x, chaudière")
        terms = query_expansion.expand("q", client=stub, household_id=HH)
        assert "a" not in terms
        assert "x" not in terms
        assert "PAC" in terms

    def test_caps_number_of_terms(self):
        many = ", ".join(f"term{i}" for i in range(50))
        stub = _StubLLMClient(text=many)
        terms = query_expansion.expand("question", client=stub, household_id=HH)
        # original + at most MAX_TERMS parsed keywords
        assert len(terms) <= query_expansion.MAX_TERMS + 1

    def test_strips_surrounding_quotes(self):
        stub = _StubLLMClient(text='"Engie", \'facture\'')
        terms = query_expansion.expand("q", client=stub, household_id=HH)
        assert "Engie" in terms
        assert "facture" in terms


class TestExpandDegradesGracefully:
    def test_llm_error_falls_back_to_original(self):
        stub = _StubLLMClient(raises=LLMError("boom"))
        terms = query_expansion.expand("ma question", client=stub, household_id=HH)
        assert terms == ["ma question"]

    def test_timeout_falls_back_to_original(self):
        stub = _StubLLMClient(raises=LLMTimeoutError("slow"))
        terms = query_expansion.expand("ma question", client=stub, household_id=HH)
        assert terms == ["ma question"]

    def test_empty_model_output_falls_back_to_original(self):
        stub = _StubLLMClient(text="   ")
        terms = query_expansion.expand("ma question", client=stub, household_id=HH)
        assert terms == ["ma question"]

    def test_blank_question_returns_empty_without_calling_llm(self):
        stub = _StubLLMClient(text="whatever")
        terms = query_expansion.expand("   ", client=stub, household_id=HH)
        assert terms == []
        assert stub.last_call is None
