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


class SearchRateThrottle(UserRateThrottle):
    """Global search (`/api/search/`) — 120 requests per minute per user.

    Full-text search costs no provider call, so the agent's caps do not apply: at
    10/min a user typing in the top-bar palette would be blocked mid-word. The bound
    exists because a type-ahead endpoint is the easiest thing to leave looping, and
    it is set well above human typing behind a 250 ms debounce.
    """
    scope = "search"


class AgentSustainedRateThrottle(UserRateThrottle):
    """100 agent questions per hour per user."""
    scope = "agent_sustained"
