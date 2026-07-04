"""
Read-side aggregations over ``AIUsageLog`` for the admin dashboard (lot 6, #109).

Pure query helpers — no HTTP concerns. All functions are household-scoped and
"usage-quality" oriented (calls, latency p95, error rate, agent IDK rate); cost
in $ is deliberately out of scope (product decision).
"""
from __future__ import annotations

import math
from datetime import timedelta
from typing import Any

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from .models import AIUsageLog

# The three windows shown as KPI columns. Ordered — the frontend renders them
# in this order.
WINDOWS: dict[str, timedelta] = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}

HISTOGRAM_DAYS = 30
RECENT_LIMIT = 50

# Quality-alert thresholds surfaced by the UI (badges, no mail/push in V1).
IDK_RATE_ALERT = 0.30
P95_MS_ALERT = 10_000


def _p95(durations: list[int]) -> int | None:
    """95th percentile (nearest-rank on the sorted values), None when empty."""
    if not durations:
        return None
    ordered = sorted(durations)
    rank = math.ceil(0.95 * len(ordered))  # nearest-rank: 1-based
    return ordered[max(0, rank - 1)]


def _idk_rate(household_id, since) -> float | None:
    """Share of agent answers that were "I don't know", over the window.

    ``answer_kind`` lives on the persisted agent turns (``AgentMessage``), not
    on the per-round-trip ``AIUsageLog`` rows — one question spans several LLM
    calls. Imported lazily to keep the apps loosely coupled.
    """
    from agent.models import AgentMessage

    answers = AgentMessage.objects.filter(
        conversation__household_id=household_id,
        role=AgentMessage.Role.AGENT,
        created_at__gte=since,
    )
    total = answers.count()
    if not total:
        return None
    idk = answers.filter(metadata__answer_kind="idk").count()
    return idk / total


def summary(household_id) -> dict[str, Any]:
    """KPIs per window: calls, error rate, latency p95, agent IDK rate."""
    now = timezone.now()
    windows: dict[str, Any] = {}
    for key, delta in WINDOWS.items():
        since = now - delta
        qs = AIUsageLog.objects.filter(household_id=household_id, created_at__gte=since)
        calls = qs.count()
        errors = qs.filter(success=False).count()
        durations = list(qs.values_list("duration_ms", flat=True))
        idk_rate = _idk_rate(household_id, since)
        p95 = _p95(durations)
        windows[key] = {
            "calls": calls,
            "errors": errors,
            "error_rate": (errors / calls) if calls else None,
            "p95_ms": p95,
            "idk_rate": idk_rate,
            "alerts": {
                "idk_rate": idk_rate is not None and idk_rate > IDK_RATE_ALERT,
                "p95_ms": p95 is not None and p95 > P95_MS_ALERT,
            },
        }
    return {"windows": windows}


def histogram(household_id, *, days: int = HISTOGRAM_DAYS) -> dict[str, Any]:
    """Per-day call counts by feature over the last ``days`` days.

    Every day of the range is present (zero-filled) so the frontend renders a
    continuous bar chart without date math.
    """
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)

    rows = (
        AIUsageLog.objects.filter(
            household_id=household_id, created_at__date__gte=start
        )
        .annotate(day=TruncDate("created_at"))
        .values("day", "feature")
        .annotate(count=Count("id"))
    )

    features: set[str] = set()
    by_day: dict[str, dict[str, int]] = {}
    for row in rows:
        day = row["day"].isoformat()
        features.add(row["feature"])
        by_day.setdefault(day, {})[row["feature"]] = row["count"]

    days_out = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).isoformat()
        days_out.append({"date": day, "counts": by_day.get(day, {})})

    return {"days": days_out, "features": sorted(features)}


def recent(household_id, *, feature: str | None = None, limit: int = RECENT_LIMIT) -> list[dict]:
    """The last ``limit`` calls, newest first, optionally filtered by feature."""
    qs = AIUsageLog.objects.filter(household_id=household_id)
    if feature:
        qs = qs.filter(feature=feature)
    rows = qs.order_by("-created_at")[: max(1, min(limit, 200))]
    return [
        {
            "id": str(row.id),
            "feature": row.feature,
            "provider": row.provider,
            "model": row.model,
            "input_tokens": row.input_tokens,
            "output_tokens": row.output_tokens,
            "duration_ms": row.duration_ms,
            "success": row.success,
            "error_type": row.error_type,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]
