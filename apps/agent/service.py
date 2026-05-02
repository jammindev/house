"""
Agent orchestrator: question -> retrieval -> LLM -> answer + citations.

`ask(question, household)` is the only thing the API view talks to. It owns the
end-to-end flow:

1. retrieval.search(household_id, question) — bounded by the household scope
2. build the prompt (system + user with citation-ready context)
3. LLM call via the configured `LLMClient`
4. parse <cite id="entity_type:id"/> markers, intersect with retrieved hits to
   keep citations honest (the LLM can't cite something we didn't retrieve)
5. return AnswerResult with the human-readable answer + machine-friendly
   citations + metadata (tokens, duration)

When retrieval returns nothing OR when the configured `ANTHROPIC_API_KEY` is
missing, the function returns a clean "I don't know" with no citations rather
than calling the LLM.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from django.conf import settings

from . import retrieval
from .llm import LLMClient, LLMError, LLMTimeoutError, get_llm_client
from .prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)

FEATURE_NAME = "agent_ask"
DEFAULT_RETRIEVAL_LIMIT = 12
DEFAULT_MAX_TOKENS = 1024
IDK_MARKER = "no_household_match"

_CITE_RE = re.compile(r'<cite\s+id="(?P<tag>[^"]+)"\s*/?>', re.IGNORECASE)


@dataclass
class Citation:
    entity_type: str
    id: Any
    label: str
    snippet: str
    url_path: str


@dataclass
class AnswerResult:
    answer: str
    citations: list[Citation]
    metadata: dict[str, Any] = field(default_factory=dict)


def ask(
    question: str,
    household,
    *,
    user=None,
    client: LLMClient | None = None,
    retrieval_limit: int = DEFAULT_RETRIEVAL_LIMIT,
) -> AnswerResult:
    """Answer ``question`` using the data of ``household``. Always returns a result."""
    cleaned = (question or "").strip()
    if not cleaned:
        return AnswerResult(answer=_dont_know_message(), citations=[])

    hits = retrieval.search(household.id, cleaned, limit=retrieval_limit)
    if not hits:
        return _idk_result()

    if not _llm_enabled():
        logger.warning("agent.ask: LLM disabled (no ANTHROPIC_API_KEY) — returning IDK")
        return _idk_result()

    llm = client or get_llm_client()
    user_prompt = build_user_prompt(cleaned, hits)

    try:
        response = llm.complete(
            system=SYSTEM_PROMPT,
            user=user_prompt,
            feature=FEATURE_NAME,
            household_id=household.id,
            user_id=getattr(user, "id", None),
            max_tokens=DEFAULT_MAX_TOKENS,
            metadata={"hits_count": len(hits)},
        )
    except LLMTimeoutError as exc:
        logger.warning("agent.ask: LLM timeout for household %s: %s", household.id, exc)
        raise
    except LLMError:
        raise

    answer_text = response.text.strip()
    citations = _resolve_citations(answer_text, hits)

    return AnswerResult(
        answer=answer_text,
        citations=citations,
        metadata={
            "duration_ms": response.duration_ms,
            "tokens_in": response.input_tokens,
            "tokens_out": response.output_tokens,
            "model": response.model,
            "hits_count": len(hits),
        },
    )


def _llm_enabled() -> bool:
    return bool(getattr(settings, "ANTHROPIC_API_KEY", "") or "")


def _dont_know_message() -> str:
    return (
        "Je n'ai pas trouvé d'information pertinente dans les données de ton "
        "foyer pour répondre à cette question."
    )


def _idk_result() -> AnswerResult:
    return AnswerResult(
        answer=_dont_know_message(),
        citations=[],
        metadata={"reason": IDK_MARKER},
    )


def _resolve_citations(answer: str, hits: list[retrieval.Hit]) -> list[Citation]:
    """Intersect the cite markers found in ``answer`` with the retrieved hits.

    A model can only cite items we showed it. If it cites something we never
    retrieved, we drop the marker — never invent a citation. Order follows the
    cite markers' first appearance in the answer.
    """
    by_tag = {f"{h.entity_type}:{h.id}": h for h in hits}
    seen: set[str] = set()
    citations: list[Citation] = []
    for match in _CITE_RE.finditer(answer or ""):
        tag = match.group("tag").strip()
        if tag in seen:
            continue
        hit = by_tag.get(tag)
        if not hit:
            continue
        seen.add(tag)
        citations.append(
            Citation(
                entity_type=hit.entity_type,
                id=hit.id,
                label=hit.label,
                snippet=hit.snippet,
                url_path=hit.url_path,
            )
        )
    return citations
