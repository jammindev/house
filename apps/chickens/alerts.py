"""
Egg-drop alert evaluation (parcours 14, Lot 6.3) — single source of truth.

``evaluate_egg_drop_alert`` is **pure**: it reads the household's egg logs +
flock journal + (optionally) the weather forecast, and returns a structured
alert or ``None``. It writes nothing — same contract as ``weather/alerts.py``.

The pivot of the module applies here too: a day **without** an ``EggLog`` is
*unknown*, never a zero. Both windows average over *logged* days only, and a
coverage guard blocks the alert when there simply isn't enough data — a few
un-logged days must not read as a laying collapse.
"""
from __future__ import annotations

from datetime import date, timedelta

from django.db.models import Avg, Count
from django.utils import timezone

from .models import ChickenEvent, EggLog

# --- Fixed thresholds (V1). Tunable in one place; per-household config is later. -
RECENT_WINDOW_DAYS = 7          # [today-6 .. today]
BASELINE_WINDOW_DAYS = 30       # 30 days ending one week before today
BASELINE_GAP_DAYS = 7           # the recent window is excluded from the baseline
DROP_THRESHOLD = 0.4            # recent <= baseline * (1 - 0.4) → drop (-40%)
CRITICAL_DROP = 0.6             # >= -60% → critical
MIN_BASELINE_DAYS = 10          # need this many logged baseline days to judge
MIN_RECENT_DAYS = 3             # …and this many logged recent days
MOLT_LOOKBACK_DAYS = 45         # a molt event this recent explains a drop

CAUSE_MOLT = "molt"
CAUSE_WEATHER = "weather"
CAUSE_UNKNOWN = "unknown"

# Weather kinds that plausibly depress laying (cold snap / heat stress).
_LAYING_WEATHER_KINDS = {"frost", "heatwave"}


def _logged_avg(household, start: date, end: date) -> tuple[float | None, int]:
    """Mean eggs over *logged* days in ``[start, end]`` and how many were logged."""
    agg = EggLog.objects.filter(
        household=household, date__gte=start, date__lte=end
    ).aggregate(avg=Avg("count"), n=Count("id"))
    return (agg["avg"], agg["n"] or 0)


def _drop_cause(household, today: date) -> str:
    """Best explanation for a drop: an active molt, then extreme weather, else unknown."""
    molt_since = today - timedelta(days=MOLT_LOOKBACK_DAYS)
    if ChickenEvent.objects.filter(
        household=household, type=ChickenEvent.Type.MOLT, occurred_on__gte=molt_since
    ).exists():
        return CAUSE_MOLT

    if "weather" not in (getattr(household, "disabled_modules", None) or []):
        try:
            from weather.alerts import evaluate_weather_alerts

            kinds = {a["kind"] for a in evaluate_weather_alerts(household)}
            if kinds & _LAYING_WEATHER_KINDS:
                return CAUSE_WEATHER
        except Exception:  # weather is a soft dependency — never break the alert
            pass

    return CAUSE_UNKNOWN


def evaluate_egg_drop_alert(household, today: date | None = None) -> dict | None:
    """Return the active egg-drop alert for ``household`` or ``None``.

    Alert shape::

        {kind:'egg_drop', severity, drop_pct, baseline_avg, recent_avg,
         cause, entity_url}

    Pure read — no writes. Returns ``None`` when coverage is too thin to judge or
    the drop is below threshold.
    """
    if household is None:
        return None
    today = today or timezone.localdate()

    recent_start = today - timedelta(days=RECENT_WINDOW_DAYS - 1)
    baseline_end = today - timedelta(days=BASELINE_GAP_DAYS)
    baseline_start = baseline_end - timedelta(days=BASELINE_WINDOW_DAYS - 1)

    baseline_avg, baseline_n = _logged_avg(household, baseline_start, baseline_end)
    recent_avg, recent_n = _logged_avg(household, recent_start, today)

    # Coverage guard — not enough data on either side to call a collapse.
    if baseline_n < MIN_BASELINE_DAYS or recent_n < MIN_RECENT_DAYS:
        return None
    if not baseline_avg or baseline_avg <= 0:
        return None

    drop_pct = 1 - (recent_avg / baseline_avg)
    if drop_pct < DROP_THRESHOLD:
        return None

    return {
        "kind": "egg_drop",
        "severity": "critical" if drop_pct >= CRITICAL_DROP else "warning",
        "drop_pct": round(drop_pct * 100),
        "baseline_avg": round(baseline_avg, 2),
        "recent_avg": round(recent_avg, 2),
        "cause": _drop_cause(household, today),
        "entity_url": "/app/chickens",
    }
