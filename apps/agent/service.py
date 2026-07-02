"""
Agent orchestrator: question -> tool-use loop -> answer + citations.

`ask(question, household)` is the only thing the API view talks to. It owns the
end-to-end flow, now driven by function calling instead of a fixed RAG pipeline:

1. build the conversation `messages` (prior turns + current question)
2. run a tool-use loop: call the LLM with the registered tools; when it asks for
   `search_household`, run the retrieval and feed the results back; repeat until
   the model produces a final answer (bounded by AGENT_MAX_TOOL_ITERATIONS)
3. accumulate every hit the tools returned into a citation pool
4. parse <cite id="entity_type:id"/> markers and intersect with that pool to keep
   citations honest (the model can't cite something we never retrieved)
5. return AnswerResult with the answer + citations + aggregated metadata

The model decides when to search. It answers dialogue and general-knowledge
turns directly (no tool call), and MUST call `search_household` before stating a
household fact (enforced by the system prompt). When the configured
`ANTHROPIC_API_KEY` is missing, the function returns a clean "I don't know"
without calling the LLM.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

from django.conf import settings

from . import tools
from .llm import LLMClient, LLMError, LLMTimeoutError, get_llm_client
from .prompts import SYSTEM_PROMPT

logger = logging.getLogger(__name__)

FEATURE_NAME = "agent_ask"
DEFAULT_MAX_TOKENS = 1024
DEFAULT_MAX_TOOL_ITERATIONS = 3
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
    history: list[dict] | None = None,
) -> AnswerResult:
    """Answer ``question`` using the data of ``household``. Always returns a result.

    ``history`` is an optional list of prior turns (``{"role", "content"}``,
    oldest first) threaded into the conversation so follow-up questions can
    resolve references to earlier turns. The model decides whether to search.
    """
    cleaned = (question or "").strip()
    if not cleaned:
        return AnswerResult(answer=_dont_know_message(), citations=[])

    if not _llm_enabled():
        logger.warning("agent.ask: LLM disabled (no ANTHROPIC_API_KEY) — returning IDK")
        return _idk_result()

    llm = client or get_llm_client()
    max_iterations = _max_tool_iterations()
    tool_schemas = tools.schemas()

    messages = _build_messages(cleaned, history)
    hit_pool: dict[tuple[str, Any], Any] = {}
    answer_text = ""
    stop_reason = ""
    model = ""
    tokens_in = 0
    tokens_out = 0
    duration_ms = 0
    tool_calls = 0
    iterations = 0

    for iterations in range(1, max_iterations + 1):
        # On the final allowed pass, drop the tools so the model is forced to
        # produce a text answer rather than requesting yet another search.
        offered_tools = tool_schemas if iterations < max_iterations else []

        try:
            response = llm.run(
                system=SYSTEM_PROMPT,
                messages=messages,
                tools=offered_tools,
                feature=FEATURE_NAME,
                household_id=household.id,
                user_id=getattr(user, "id", None),
                max_tokens=DEFAULT_MAX_TOKENS,
                metadata={"iteration": iterations},
            )
        except LLMTimeoutError as exc:
            logger.warning("agent.ask: LLM timeout for household %s: %s", household.id, exc)
            raise
        except LLMError:
            raise

        tokens_in += response.input_tokens or 0
        tokens_out += response.output_tokens or 0
        duration_ms += response.duration_ms or 0
        model = response.model
        stop_reason = response.stop_reason
        answer_text = response.text.strip()

        if response.stop_reason != "tool_use" or not response.tool_calls:
            break

        # Replay the assistant turn (text + tool_use blocks), then answer each
        # tool call with a tool_result before looping.
        messages.append({"role": "assistant", "content": response.assistant_blocks})
        tool_results = []
        for call in response.tool_calls:
            tool_calls += 1
            result = tools.dispatch(
                call.name, call.input, household=household, user=user, client=llm
            )
            for hit in result.hits:
                hit_pool[(hit.entity_type, hit.id)] = hit
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": result.rendered,
                }
            )
        messages.append({"role": "user", "content": tool_results})

    hits = list(hit_pool.values())
    citations = _resolve_citations(answer_text, hits)
    answer_kind = _classify_answer(tool_calls, hits, citations)

    return AnswerResult(
        answer=answer_text or _dont_know_message(),
        citations=citations,
        metadata={
            "duration_ms": duration_ms,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "model": model,
            "hits_count": len(hits),
            "tool_calls": tool_calls,
            "iterations": iterations,
            "stop_reason": stop_reason,
            "answer_kind": answer_kind,
        },
    )


def _build_messages(question: str, history: list[dict] | None) -> list[dict]:
    """Turn prior turns + the current question into Anthropic messages.

    History roles come from ``AgentMessage`` (``"user"`` / ``"agent"``); the
    agent role maps to ``"assistant"``. Empty turns are skipped. The current
    question is always the trailing user turn.
    """
    messages: list[dict] = []
    for turn in history or []:
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        role = "user" if turn.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})
    return messages


def _classify_answer(tool_calls: int, hits: list, citations: list) -> str:
    """Coarse label for observability (metadata.answer_kind).

    - ``direct``  : no tool call (dialogue or general knowledge)
    - ``idk``     : searched but found nothing
    - ``household``: searched, found data, and cited it
    - ``uncited`` : searched, found data, but produced no citation
    """
    if tool_calls == 0:
        return "direct"
    if not hits:
        return "idk"
    if citations:
        return "household"
    return "uncited"


def _max_tool_iterations() -> int:
    value = getattr(settings, "AGENT_MAX_TOOL_ITERATIONS", DEFAULT_MAX_TOOL_ITERATIONS)
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return DEFAULT_MAX_TOOL_ITERATIONS


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


def _resolve_citations(answer: str, hits: list) -> list[Citation]:
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
