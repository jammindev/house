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

from . import context as context_builder
from . import memory as memory_service
from . import tools
from .llm import LLMClient, LLMError, LLMTimeoutError, get_llm_client
from .prompts import build_system_prompt

logger = logging.getLogger(__name__)

FEATURE_NAME = "agent_ask"
DEFAULT_MAX_TOKENS = 1024
DEFAULT_MAX_TOOL_ITERATIONS = 3
IDK_MARKER = "no_household_match"

# The prompt asks for double quotes, but models occasionally emit single quotes —
# accept both rather than silently dropping the citation.
_CITE_RE = re.compile(r'''<cite\s+id=["'](?P<tag>[^"']+)["']\s*/?>''', re.IGNORECASE)


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
    context_entity: tuple[str, str] | None = None,
) -> AnswerResult:
    """Answer ``question`` using the data of ``household``. Always returns a result.

    Thin non-streaming wrapper: drains ``ask_stream`` and returns its final
    ``AnswerResult``. Kept as the single entry point for callers that don't
    stream (legacy ``/ask/`` endpoint, tests, CLI usage).
    """
    result: AnswerResult | None = None
    for event in ask_stream(
        question,
        household,
        user=user,
        client=client,
        history=history,
        context_entity=context_entity,
    ):
        if event["type"] == "result":
            result = event["result"]
    assert result is not None  # ask_stream always ends with a result event
    return result


def ask_stream(
    question: str,
    household,
    *,
    user=None,
    client: LLMClient | None = None,
    history: list[dict] | None = None,
    context_entity: tuple[str, str] | None = None,
):
    """Streaming variant of ``ask`` — a generator of progress events.

    Yields dict events, always ending with the result:

    - ``{"type": "delta", "text": chunk}`` — a piece of model text as it is
      produced (only when the client supports ``run_stream``; text emitted
      before a tool call is preamble the frontend may discard on "tool");
    - ``{"type": "tool", "name": tool_name}`` — a tool call is being executed;
    - ``{"type": "result", "result": AnswerResult}`` — the final answer, same
      object ``ask`` returns (citations resolved, metadata aggregated).

    ``history`` is an optional list of prior turns (``{"role", "content"}``,
    oldest first). ``context_entity`` is an optional ``(entity_type, object_id)``
    anchor whose full context is pre-injected (see ``ask``).
    """
    cleaned = (question or "").strip()
    if not cleaned:
        yield {"type": "result", "result": AnswerResult(answer=_dont_know_message(), citations=[])}
        return

    if not _llm_enabled():
        logger.warning("agent.ask: LLM disabled (no ANTHROPIC_API_KEY) — returning IDK")
        yield {"type": "result", "result": _idk_result()}
        return

    llm = client or get_llm_client()
    max_iterations = _max_tool_iterations()
    tool_schemas = tools.schemas()

    hit_pool: dict[tuple[str, Any], Any] = {}

    # Resolve the anchor (if any) before building the conversation so its context
    # leads the messages and its hits are citable from the first answer.
    entity_context = _resolve_context(context_entity, household)
    anchored = entity_context is not None
    if anchored:
        for hit in entity_context.hits:
            hit_pool[(hit.entity_type, hit.id)] = hit

    # User memory: with a user and their flag ON, inject their stored memories
    # and let the model capture new facts spontaneously; flag OFF keeps the tool
    # for explicit "remember that…" requests but injects nothing. No user (bare
    # `ask`, tests) → the prompt never mentions memory.
    memory_mode = None
    memories: list = []
    if user is not None and getattr(user, "pk", None) is not None:
        if memory_service.memory_enabled(user):
            memory_mode = "auto"
            memories = memory_service.user_memories(household, user)
        else:
            memory_mode = "manual"

    web_search_on = _web_search_enabled()
    system_prompt = build_system_prompt(
        anchored=anchored,
        memory_mode=memory_mode,
        memories=memories,
        web_search=web_search_on,
    )
    messages = _build_messages(cleaned, history, entity_context)
    created_entities: list[dict] = []
    updated_entities: list[dict] = []
    memory_events: list[dict] = []
    web_sources: list[dict] = []
    write_signatures: set = set()
    answer_text = ""
    stop_reason = ""
    model = ""
    tokens_in = 0
    tokens_out = 0
    duration_ms = 0
    tool_calls = 0
    iterations = 0
    resuming_pause = False

    for iterations in range(1, max_iterations + 1):
        # On the final allowed pass, drop the tools so the model is forced to
        # produce a text answer rather than requesting yet another search —
        # UNLESS we're resuming a paused server search, which needs the tools
        # (incl. web_search) still declared to continue.
        offered_tools = tool_schemas if (iterations < max_iterations or resuming_pause) else []
        resuming_pause = False

        run_kwargs = dict(
            system=system_prompt,
            messages=messages,
            tools=offered_tools,
            feature=FEATURE_NAME,
            household_id=household.id,
            user_id=getattr(user, "id", None),
            max_tokens=DEFAULT_MAX_TOKENS,
            metadata={"iteration": iterations},
            web_search=web_search_on,
        )
        try:
            # Stream when the client supports it, forwarding text chunks as they
            # arrive; otherwise (stub clients, future providers) fall back to the
            # blocking round-trip — same LLMRunResponse either way.
            run_stream = getattr(llm, "run_stream", None)
            if run_stream is not None:
                response = None
                for kind, payload in run_stream(**run_kwargs):
                    if kind == "delta":
                        yield {"type": "delta", "text": payload}
                    else:
                        response = payload
                assert response is not None  # run_stream always ends with final
            else:
                response = llm.run(**run_kwargs)
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
        web_sources.extend(getattr(response, "web_sources", None) or [])

        # The server-side web search loop paused mid-turn (hit its own iteration
        # limit). Replay the assistant turn — which includes the trailing
        # server_tool_use block — with no client tool_result; the server resumes.
        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.assistant_blocks})
            resuming_pause = True
            continue

        if response.stop_reason != "tool_use" or not response.tool_calls:
            break

        # Replay the assistant turn (text + tool_use blocks), then answer each
        # tool call with a tool_result before looping.
        messages.append({"role": "assistant", "content": response.assistant_blocks})
        tool_results = []
        for call in response.tool_calls:
            tool_calls += 1
            # Anti-duplicate guard for writes: if the model repeats the same
            # create/update call in this turn, skip the DB write and tell it so.
            if call.name in (
                tools.CREATE_ENTITY,
                tools.UPDATE_ENTITY,
                tools.MANAGE_MEMORY,
            ) and _is_duplicate_write(call.name, call.input, write_signatures):
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call.id,
                        "content": "(already did this exact write in this turn — skipped)",
                    }
                )
                continue

            yield {"type": "tool", "name": call.name}
            result = tools.dispatch(
                call.name,
                call.input,
                household=household,
                user=user,
                client=llm,
                context_entity=context_entity if entity_context else None,
            )
            for hit in result.hits:
                hit_pool[(hit.entity_type, hit.id)] = hit
            created_entities.extend(result.created)
            updated_entities.extend(result.updated)
            memory_events.extend(result.memories)
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
    web_sources = _dedupe_web_sources(web_sources)
    answer_kind = _classify_answer(tool_calls, hits, citations, web_sources)

    yield {"type": "result", "result": AnswerResult(
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
            # The model ran out of max_tokens mid-answer — the text is cut short.
            # Surfaced so the frontend can tell the user instead of serving a
            # sentence that just stops.
            "truncated": stop_reason == "max_tokens",
            "answer_kind": answer_kind,
            "anchored": anchored,
            "created_entities": created_entities,
            "updated_entities": updated_entities,
            "memory_events": memory_events,
            # Public web sources the model used this turn (web_search tool).
            "web_sources": web_sources,
        },
    )}


def _is_duplicate_write(name: str, tool_input: dict, seen: set) -> bool:
    """True if this exact write call was already made this turn; records it otherwise.

    The signature covers the tool name, the target (entity_type + id for
    updates) and the fields — so "create task A" then "create task B" both run,
    but the same call repeated verbatim is skipped. ``manage_memory`` has a flat
    input (action/content/memory_id), so its whole input is the signature.
    """
    if name == tools.MANAGE_MEMORY:
        signature = (name, tools._stable_signature(tool_input or {}))
    else:
        entity_type = (tool_input or {}).get("entity_type") or ""
        target_id = str((tool_input or {}).get("id") or "")
        fields = (tool_input or {}).get("fields") or {}
        signature = (
            name,
            entity_type,
            target_id,
            tools._stable_signature(fields if isinstance(fields, dict) else {}),
        )
    if signature in seen:
        return True
    seen.add(signature)
    return False


def _resolve_context(context_entity, household):
    """Resolve an ``(entity_type, object_id)`` anchor into an EntityContext or None.

    Never raises into ``ask``: an unknown/malformed/orphaned anchor just yields
    ``None`` and the conversation proceeds unanchored.
    """
    if not context_entity:
        return None
    entity_type, object_id = context_entity
    if not entity_type or not object_id:
        return None
    return context_builder.build_entity_context(entity_type, object_id, household)


# Frames the pre-injected anchor context as the opening user turn. The assistant
# ack keeps a valid user/assistant alternation before the real history/question.
_CONTEXT_PREAMBLE = (
    "[CONTEXT — {label}]\n"
    "Here is the full context of the item this conversation is about (the item "
    "and everything linked to it), each with a citable id. Use it to answer "
    "directly.\n\n{rendered}"
)
_CONTEXT_ACK = "Understood — I have the full context of this item and will answer from it."


def _build_messages(
    question: str,
    history: list[dict] | None,
    entity_context=None,
) -> list[dict]:
    """Turn the optional anchor context + prior turns + the question into messages.

    History roles come from ``AgentMessage`` (``"user"`` / ``"agent"``); the
    agent role maps to ``"assistant"``. Empty turns are skipped. When an
    ``entity_context`` is present it leads as a synthetic user/assistant pair so
    the model starts already holding the item's data. The current question is
    always the trailing user turn.
    """
    messages: list[dict] = []
    if entity_context is not None:
        messages.append(
            {
                "role": "user",
                "content": _CONTEXT_PREAMBLE.format(
                    label=entity_context.label, rendered=entity_context.rendered
                ),
            }
        )
        messages.append({"role": "assistant", "content": _CONTEXT_ACK})
    for turn in history or []:
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        role = "user" if turn.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})
    return messages


def _classify_answer(tool_calls: int, hits: list, citations: list, web_sources: list) -> str:
    """Coarse label for observability (metadata.answer_kind).

    - ``direct``  : no tool call (dialogue or general knowledge)
    - ``web``     : answered from a web search, with no household data
    - ``idk``     : searched household data but found nothing
    - ``household``: searched, found data, and cited it
    - ``uncited`` : searched, found data, but produced no citation
    """
    if tool_calls == 0:
        return "web" if web_sources else "direct"
    if not hits:
        return "web" if web_sources else "idk"
    if citations:
        return "household"
    return "uncited"


def _dedupe_web_sources(sources: list[dict]) -> list[dict]:
    """Drop duplicate web sources by URL, preserving first-seen order."""
    seen: set[str] = set()
    unique: list[dict] = []
    for source in sources:
        url = (source or {}).get("url")
        if not url or url in seen:
            continue
        seen.add(url)
        unique.append(source)
    return unique


def _max_tool_iterations() -> int:
    value = getattr(settings, "AGENT_MAX_TOOL_ITERATIONS", DEFAULT_MAX_TOOL_ITERATIONS)
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return DEFAULT_MAX_TOOL_ITERATIONS


def _llm_enabled() -> bool:
    return bool(getattr(settings, "ANTHROPIC_API_KEY", "") or "")


def _web_search_enabled() -> bool:
    """Whether the agent may use the server-side web search tool (settings flag)."""
    return bool(getattr(settings, "AGENT_WEB_SEARCH_ENABLED", False))


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
