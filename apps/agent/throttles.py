"""
Agent endpoint throttles.

Every agent question triggers up to AGENT_MAX_TOOL_ITERATIONS LLM calls plus a
query-expansion call — unthrottled, an authenticated user could generate
unbounded provider cost. Two independent axes, both per user:

- AgentBurstRateThrottle    : short-window cap (absorbs runaway loops/scripts)
- AgentSustainedRateThrottle: hourly cap (bounds the cost of a long session)

Rates are configurable via settings:
    DEFAULT_THROTTLE_RATES = {
        "agent_burst":     "10/min",
        "agent_sustained": "100/hour",
    }
"""
from rest_framework.throttling import UserRateThrottle


class AgentBurstRateThrottle(UserRateThrottle):
    """10 agent questions per minute per user."""
    scope = "agent_burst"


class AgentSustainedRateThrottle(UserRateThrottle):
    """100 agent questions per hour per user."""
    scope = "agent_sustained"
