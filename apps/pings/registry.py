"""
Registry of proactive pings the agent can send without being asked first.

Same philosophy as ``agent.searchables`` / ``agent.writables``: the pings core
never hardcodes the list of pings — each app declares its own ``PingSpec`` from
``apps.py.ready()``, so the scheduler tick covers N pings and adding one is a
few lines with zero touch to ``apps/pings/``.

A ping is a *templated* question pushed to the user (Telegram today); the LLM
is never involved in the outbound message — it only enters the loop when the
user replies, through the regular ``agent.service.ask`` pipeline, with the
ping visible in the conversation history.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import time


@dataclass(frozen=True)
class PingSpec:
    """Declarative description of one proactive ping type."""

    ping_type: str
    """Discriminator stored on preferences and logs (e.g. 'egg_log')."""

    build_message: Callable[..., str | None]
    """``build_message(household, user, *, today) -> str | None``.

    Called inside the recipient's language (``translation.override``), with
    ``today`` being the household-local date. Returning ``None`` means "not
    worth sending today" (data already entered, nothing to ask) — the tick
    skips silently and re-evaluates on the next pass. Must be cheap: it runs
    on every tick once the send time has passed."""

    default_send_at: time
    """Default local send time offered when the user enables the ping."""

    module: str | None = None
    """Optional module key (households.modules.OPTIONAL_MODULES). When the
    household disabled that module, the ping is neither listed nor sent.
    None = core."""


REGISTRY: dict[str, PingSpec] = {}


def register(spec: PingSpec) -> None:
    """Add a spec to the registry. Raises if ``ping_type`` is already registered."""
    if spec.ping_type in REGISTRY:
        raise ValueError(
            f"PingSpec for ping_type={spec.ping_type!r} is already registered"
        )
    REGISTRY[spec.ping_type] = spec


def find_spec(ping_type: str) -> PingSpec | None:
    return REGISTRY.get(ping_type)


def specs_for_household(household) -> list[PingSpec]:
    """Registered specs minus those whose module the household disabled."""
    disabled = frozenset(getattr(household, "disabled_modules", None) or [])
    return [
        spec
        for spec in REGISTRY.values()
        if spec.module is None or spec.module not in disabled
    ]
