"""
Agent tool registry — the base of function calling.

Same pattern as ``searchables.py``: each tool declares itself, the orchestrator
(``service.ask``) never hardcodes the tool list. Three read tools are registered:

- ``search_household`` — wraps query expansion + retrieval so the model pulls
  household facts **on demand** instead of the pipeline searching every turn.
- ``get_entity`` — reads the FULL content of one item by ``(entity_type, id)``,
  bypassing the search snippet budget (e.g. a whole invoice OCR).
- ``get_related`` — loads everything LINKED to one item by ``(entity_type, id)``
  (e.g. a project's documents, expenses, tasks, zones), each as a citable Hit.

Adding a future tool (``create_interaction``, ``create_task``, …) = one
``register(...)`` call, no change to ``service.py``.

Contract:
- ``AgentTool`` carries the Anthropic tool schema (name / description /
  input_schema) plus a ``handler``.
- A handler receives ``household``, ``user``, the raw ``tool_input`` dict, and an
  optional ``client`` (so the loop can share its LLM client). It returns a
  ``ToolResult`` with the text to feed back to the model (``rendered``) and, for
  retrieval tools, the ``hits`` used to keep citations honest.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from django.core.exceptions import ValidationError

from . import query_expansion, retrieval, searchables
from .llm import LLMClient, get_llm_client
from .prompts import render_context_block
from .retrieval import Hit

logger = logging.getLogger(__name__)

# How many hits a single search returns. Mirrors the historical pipeline limit.
SEARCH_RETRIEVAL_LIMIT = 12

# Char cap when reading ONE entity in full via get_entity. Much larger than the
# per-hit budget of search_household (2000) — the whole point is to read the
# complete text (e.g. a full invoice OCR) the search snippet had to truncate.
FULL_CONTENT_BUDGET = 20000
FULL_CONTENT_SNIPPET_CHARS = 200


@dataclass
class ToolResult:
    """Outcome of a tool call.

    ``rendered`` is the text injected back into the conversation as a
    ``tool_result`` block. ``hits`` is the retrieval hits (empty for non-search
    tools) that the orchestrator accumulates into the citation pool.
    """

    rendered: str
    hits: list[Hit] = field(default_factory=list)


@dataclass(frozen=True)
class AgentTool:
    name: str
    description: str
    input_schema: dict
    handler: Callable[..., ToolResult]

    def to_schema(self) -> dict:
        """Return the Anthropic tools API schema for this tool."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


REGISTRY: dict[str, AgentTool] = {}


def register(tool: AgentTool) -> None:
    """Register a tool. Double registration is a programming error."""
    if tool.name in REGISTRY:
        raise ValueError(f"Agent tool already registered: {tool.name!r}")
    REGISTRY[tool.name] = tool


def reset_registry() -> None:
    """Clear the registry — test helper only."""
    REGISTRY.clear()


def schemas() -> list[dict]:
    """Return the tool schemas to pass to the LLM (stable order)."""
    return [tool.to_schema() for tool in REGISTRY.values()]


def dispatch(
    name: str,
    tool_input: dict[str, Any] | None,
    *,
    household,
    user=None,
    client: LLMClient | None = None,
) -> ToolResult:
    """Run the registered handler for ``name``.

    An unknown tool name never raises into the loop — it returns a ``ToolResult``
    the model can read and recover from.
    """
    tool = REGISTRY.get(name)
    if tool is None:
        logger.warning("agent.tools: unknown tool requested: %s", name)
        return ToolResult(rendered=f"(unknown tool: {name})")
    return tool.handler(
        household=household,
        user=user,
        tool_input=tool_input or {},
        client=client,
    )


# --- search_household -------------------------------------------------------

SEARCH_HOUSEHOLD = "search_household"

_SEARCH_HOUSEHOLD_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": (
                "Keywords or a short phrase to look up in the household data "
                "(documents, interactions, equipment, tasks, projects, zones, "
                "stock, insurance, contacts). Use the subject of the question, "
                "not a full sentence."
            ),
        }
    },
    "required": ["query"],
}

_SEARCH_HOUSEHOLD_DESCRIPTION = (
    "Search the family's household data and return matching items with their "
    "citable ids. Call this before stating any fact about the household "
    "(amounts, dates, brands, equipment, contracts, contacts). Returns nothing "
    "when the household has no matching data."
)


def _search_household_handler(
    *,
    household,
    user=None,
    tool_input: dict[str, Any],
    client: LLMClient | None = None,
) -> ToolResult:
    """Expand the query, run scoped retrieval, render a citable context block."""
    query = (tool_input.get("query") or "").strip()
    if not query:
        return ToolResult(rendered="(empty query — nothing searched)")

    llm = client or get_llm_client()
    terms = query_expansion.expand(
        query,
        client=llm,
        household_id=household.id,
        user_id=getattr(user, "id", None),
    )
    hits = retrieval.search_multi(household.id, terms, limit=SEARCH_RETRIEVAL_LIMIT)
    return ToolResult(rendered=render_context_block(hits), hits=hits)


def build_search_household_tool() -> AgentTool:
    return AgentTool(
        name=SEARCH_HOUSEHOLD,
        description=_SEARCH_HOUSEHOLD_DESCRIPTION,
        input_schema=_SEARCH_HOUSEHOLD_SCHEMA,
        handler=_search_household_handler,
    )


# --- get_entity -------------------------------------------------------------

GET_ENTITY = "get_entity"

_GET_ENTITY_SCHEMA = {
    "type": "object",
    "properties": {
        "entity_type": {
            "type": "string",
            "description": (
                "The type of item, exactly as it appears in an id=... tag or "
                "citation (e.g. 'document', 'equipment', 'interaction')."
            ),
        },
        "id": {
            "type": "string",
            "description": "The item id, exactly as it appears after the colon in id=<type>:<id>.",
        },
    },
    "required": ["entity_type", "id"],
}

_GET_ENTITY_DESCRIPTION = (
    "Read the FULL content of one household item you already identified (from a "
    "search_household result or a citation). Use it when a search snippet is not "
    "enough and you need the complete text — a document's full OCR, every line "
    "item and amount on an invoice, the full notes of an equipment. Provide "
    "entity_type and id exactly as shown in the id=<type>:<id> tag."
)


def _resolve_entity(entity_type: str, raw_id: str, household):
    """Shared (entity_type, id) → instance resolution for get_entity/get_related.

    Returns ``(obj, None)`` on success or ``(None, ToolResult)`` with a
    recoverable message the model can read (unknown type, malformed id, no row).
    """
    if not entity_type or not raw_id:
        return None, ToolResult(rendered="(needs both entity_type and id)")

    spec = searchables.find_spec(entity_type)
    if spec is None:
        return None, ToolResult(rendered=f"(unknown entity_type: {entity_type})")

    try:
        obj = spec.model.objects.filter(household_id=household.id, pk=raw_id).first()
    except (ValueError, TypeError, ValidationError):
        # Malformed id (e.g. not a valid UUID) — recoverable, tell the model.
        return None, ToolResult(rendered=f"(invalid id for {entity_type}: {raw_id})")

    if obj is None:
        return None, ToolResult(
            rendered=f"(no {entity_type} found with id {raw_id} in this household)"
        )
    return (spec, obj), None


def _get_entity_handler(
    *,
    household,
    user=None,
    tool_input: dict[str, Any],
    client: LLMClient | None = None,
) -> ToolResult:
    """Fetch one entity by (entity_type, id), scoped household, and read it whole."""
    entity_type = (tool_input.get("entity_type") or "").strip()
    raw_id = (tool_input.get("id") or "").strip()

    resolved, error = _resolve_entity(entity_type, raw_id, household)
    if error is not None:
        return error
    spec, obj = resolved

    hit = retrieval.hit_from_instance(spec, obj, snippet_chars=FULL_CONTENT_SNIPPET_CHARS)
    # content_top_n=1 + a big budget → the whole content, in the citable format.
    rendered = render_context_block(
        [hit],
        content_top_n=1,
        char_budget_per_hit=FULL_CONTENT_BUDGET,
        total_char_budget=FULL_CONTENT_BUDGET,
    )
    return ToolResult(rendered=rendered, hits=[hit])


def build_get_entity_tool() -> AgentTool:
    return AgentTool(
        name=GET_ENTITY,
        description=_GET_ENTITY_DESCRIPTION,
        input_schema=_GET_ENTITY_SCHEMA,
        handler=_get_entity_handler,
    )


# --- get_related ------------------------------------------------------------

GET_RELATED = "get_related"

# A project can have many linked items; cap how many we pull into one result and
# how much text they share, so a single get_related call stays bounded.
RELATED_MAX_ITEMS = 40
RELATED_CONTENT_TOP_N = 2
RELATED_CHAR_BUDGET_PER_HIT = 2000
RELATED_TOTAL_CHAR_BUDGET = 8000

_GET_RELATED_SCHEMA = {
    "type": "object",
    "properties": {
        "entity_type": {
            "type": "string",
            "description": (
                "The type of the item whose neighborhood to load, exactly as it "
                "appears in an id=<type>:<id> tag (e.g. 'project')."
            ),
        },
        "id": {
            "type": "string",
            "description": "The item id, exactly as it appears after the colon in id=<type>:<id>.",
        },
    },
    "required": ["entity_type", "id"],
}

_GET_RELATED_DESCRIPTION = (
    "Load everything LINKED to one household item you already identified: e.g. a "
    "project's documents, expenses/interactions, tasks and zones. Use it when the "
    "user wants the full picture of a project or piece of equipment (typically "
    "after they confirm which one). Returns each related item with its own citable "
    "id, so you can then get_entity into any specific one. Provide entity_type and "
    "id exactly as shown in the id=<type>:<id> tag."
)


def _get_related_handler(
    *,
    household,
    user=None,
    tool_input: dict[str, Any],
    client: LLMClient | None = None,
) -> ToolResult:
    """Resolve the source entity, walk its declared relations, render them citable."""
    entity_type = (tool_input.get("entity_type") or "").strip()
    raw_id = (tool_input.get("id") or "").strip()

    resolved, error = _resolve_entity(entity_type, raw_id, household)
    if error is not None:
        return error
    spec, obj = resolved

    if spec.related is None:
        return ToolResult(rendered=f"({entity_type} has no related items to load)")

    hits: list[Hit] = []
    for rel in list(spec.related(obj))[:RELATED_MAX_ITEMS]:
        rel_spec = searchables.find_spec_for_instance(rel)
        if rel_spec is None:
            continue
        # Defensive scope guard: never surface an item from another household.
        if getattr(rel, "household_id", household.id) != household.id:
            continue
        hits.append(retrieval.hit_from_instance(rel_spec, rel))

    if not hits:
        return ToolResult(rendered=f"(no items linked to {entity_type} {raw_id})")

    rendered = render_context_block(
        hits,
        content_top_n=RELATED_CONTENT_TOP_N,
        char_budget_per_hit=RELATED_CHAR_BUDGET_PER_HIT,
        total_char_budget=RELATED_TOTAL_CHAR_BUDGET,
    )
    return ToolResult(rendered=rendered, hits=hits)


def build_get_related_tool() -> AgentTool:
    return AgentTool(
        name=GET_RELATED,
        description=_GET_RELATED_DESCRIPTION,
        input_schema=_GET_RELATED_SCHEMA,
        handler=_get_related_handler,
    )
