"""
Orchard stats agent tool (parcours 30, lot 8) — ``get_harvest_stats``.

« Combien de kilos de pommes cette année ? » is **one number**, not a page of
records: aggregates ride a dedicated read-only tool rather than the
``listables`` registry, exactly like ``get_chicken_stats`` and ``get_weather``.
Registered from ``orchard/apps.py::ready()``; ``apps/agent/`` is never touched.

The result is neutral data (English labels + numbers); the model phrases the
final answer in the reader's language, like search results.
"""
from __future__ import annotations

from typing import Any

from agent.tools import AgentTool, ToolResult

GET_HARVEST_STATS = "get_harvest_stats"

_SCHEMA = {
    "type": "object",
    "properties": {
        "tree": {
            "type": "string",
            "description": (
                "Optional: the name of one subject (« le gros pommier »). "
                "Omit for the whole orchard."
            ),
        },
        "seasons": {
            "type": "integer",
            "description": "How many past seasons to include (default 5).",
        },
    },
    "required": [],
}

_DESCRIPTION = (
    "Get harvest totals for the household orchard, season by season: how much a "
    "subject or the whole orchard produced each year, and what is due for care "
    "this season. Call this for ANY question about how much fruit was picked, "
    "whether a tree produces less than before, comparing years, or what the "
    "orchard needs right now. Totals are always given **per unit** (kg, pieces, "
    "litres) and never added together. Returns a note when the orchard module is "
    "disabled."
)


def _handler(
    *,
    household,
    user=None,
    tool_input: dict[str, Any],
    client=None,
    context_entity: tuple[str, str] | None = None,
) -> ToolResult:
    if household is None or "orchard" in (getattr(household, "disabled_modules", None) or []):
        return ToolResult(rendered="(the orchard module is not enabled for this household)")

    from .queries import harvest_series, rule_states
    from .services import resolve_tree

    raw_tree = (tool_input or {}).get("tree")
    tree = None
    if raw_tree:
        try:
            tree = resolve_tree(household, raw_tree)
        except ValueError as exc:
            # An ambiguous name names its candidates rather than picking one —
            # answering about the wrong plum tree is worse than asking again.
            return ToolResult(rendered=f"({exc})")

    seasons = (tool_input or {}).get("seasons") or 5
    series = harvest_series(household, tree=tree, seasons=int(seasons))

    lines = [f"Orchard harvests — {tree.name if tree else 'whole orchard'}"]
    if not series["seasons"]:
        lines.append("No harvest recorded yet.")
    for season in series["seasons"]:
        totals = ", ".join(f"{row['quantity']} {row['unit']}" for row in season["totals"])
        current = " (current season)" if season["season"] == series["current_season"] else ""
        lines.append(f"- {season['season']}{current}: {totals}")

    pending = [
        state
        for state in rule_states(household)
        if state["state"] in ("due", "missed")
        and (tree is None or state["tree"].id == tree.id)
    ]
    if pending:
        lines.append("Care due this season:")
        for state in pending:
            lines.append(
                f"- {state['rule'].name} on {state['tree'].name} "
                f"({state['state']}, window ends {state['window_end'].isoformat()})"
            )

    return ToolResult(rendered="\n".join(lines))


def build_get_harvest_stats_tool() -> AgentTool:
    """Factory for the ``get_harvest_stats`` agent tool (registered from apps.py)."""
    return AgentTool(
        name=GET_HARVEST_STATS,
        description=_DESCRIPTION,
        input_schema=_SCHEMA,
        handler=_handler,
    )
