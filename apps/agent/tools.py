"""
Agent tool registry — the base of function calling.

Same pattern as ``searchables.py``: each tool declares itself, the orchestrator
(``service.ask``) never hardcodes the tool list. The first — and for now only —
tool is ``search_household``, which wraps query expansion + retrieval so the
model pulls household facts **on demand** instead of the pipeline searching on
every turn.

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

from . import query_expansion, retrieval
from .llm import LLMClient, get_llm_client
from .prompts import render_context_block
from .retrieval import Hit

logger = logging.getLogger(__name__)

# How many hits a single search returns. Mirrors the historical pipeline limit.
SEARCH_RETRIEVAL_LIMIT = 12


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
