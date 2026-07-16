"""
Chicken stats agent tool (parcours 14, Lot 6.4) — ``get_chicken_stats``.

Laying/health stats are **aggregates**, not listable rows, so — like the weather
module's ``get_weather`` — the chickens app exposes a dedicated read-only tool
rather than riding the ``searchables``/``listables`` registries. Registered from
``chickens/apps.py::ready()`` via ``agent.tools.register``; ``apps/agent/`` is
never touched.

The result is neutral data (English labels + numbers); the model phrases the
final answer in the user's language, exactly like search results.
"""
from __future__ import annotations

from typing import Any

from agent.tools import AgentTool, ToolResult

GET_CHICKEN_STATS = "get_chicken_stats"

_GET_CHICKEN_STATS_SCHEMA = {
    "type": "object",
    "properties": {},
    "required": [],
}

_GET_CHICKEN_STATS_DESCRIPTION = (
    "Get the household flock stats: headcount, eggs collected today / this week / "
    "average per laying day (7 and 30 days), the egg-log coverage (how many days "
    "were actually recorded), the cost per egg, and whether an abnormal drop in "
    "laying is currently detected (with its likely cause: molt, weather, or "
    "unknown). Call this for ANY question about egg production, laying trends, "
    "whether the hens are laying less than usual, flock size, or how much an egg "
    "costs. Returns a note when the chickens module is disabled."
)


def _fmt(value) -> str:
    if value is None:
        return "?"
    if isinstance(value, float):
        return f"{round(value, 2)}"
    return f"{value}"


def _get_chicken_stats_handler(
    *,
    household,
    user=None,
    tool_input: dict[str, Any],
    client=None,
    context_entity: tuple[str, str] | None = None,
) -> ToolResult:
    if household is None or "chickens" in (getattr(household, "disabled_modules", None) or []):
        return ToolResult(rendered="(the chickens module is not enabled for this household)")

    from .alerts import evaluate_egg_drop_alert
    from .services import egg_stats, flock_summary

    summary = flock_summary(household)
    stats = egg_stats(household, period=30)
    cov = stats["coverage"]
    cost = summary["cost"]

    lines: list[str] = ["Flock stats:"]
    lines.append(f"- Hens in flock: {summary['active_count']}")
    lines.append(f"- Eggs today: {_fmt(summary['eggs_today'])}")
    lines.append(f"- Eggs last 7 days (total): {summary['eggs_7d']}")
    lines.append(f"- Average per laying day: 7d={_fmt(stats['avg_7d'])}, 30d={_fmt(stats['avg_30d'])}")
    lines.append(f"- This month (total): {stats['month_total']}")
    lines.append(
        f"- Log coverage (last 30 days): {cov['logged_days']}/{cov['total_days']} days recorded"
    )
    if cost.get("per_egg"):
        lines.append(
            f"- Cost per egg: {cost['per_egg']} (feed {cost.get('feed_total', '?')} + "
            f"flock {cost.get('flock_total', '?')}, over {cost['eggs_total']} eggs)"
        )
    else:
        lines.append("- Cost per egg: not enough data yet")

    alert = evaluate_egg_drop_alert(household)
    if alert is not None:
        lines.append(
            f"- ABNORMAL DROP detected: laying down {alert['drop_pct']}% "
            f"(recent avg {alert['recent_avg']} vs baseline {alert['baseline_avg']}), "
            f"likely cause: {alert['cause']}."
        )
    else:
        lines.append("- No abnormal laying drop detected.")

    return ToolResult(rendered="\n".join(lines))


def build_get_chicken_stats_tool() -> AgentTool:
    """Factory for the ``get_chicken_stats`` agent tool (registered from apps.py)."""
    return AgentTool(
        name=GET_CHICKEN_STATS,
        description=_GET_CHICKEN_STATS_DESCRIPTION,
        input_schema=_GET_CHICKEN_STATS_SCHEMA,
        handler=_get_chicken_stats_handler,
    )
