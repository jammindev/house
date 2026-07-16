"""
Digest section collectors — one per source module.

Each collector is a pure read that turns its module's data into a
``DigestSection`` (a title + a few localized lines) or ``None`` when there is
nothing worth reporting today. Collectors are blind to each other and must be
cheap: they run on every scheduler tick once the send time has passed, and on
every in-app preview.

They are called inside the recipient's language (``translation.override`` in the
ping path, an explicit override in the API path), so ``gettext`` picks the right
locale. Module imports are done lazily inside each function to keep this module
import-safe regardless of app-loading order.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Q
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)


@dataclass
class DigestSection:
    """One rendered block of the digest."""

    key: str
    emoji: str
    title: str            # localized
    lines: list[str] = field(default_factory=list)  # localized


@dataclass(frozen=True)
class SectionSpec:
    """Declarative description of a digest section."""

    key: str
    module: str | None                       # households.modules key, None = core
    collect: Callable[..., DigestSection | None]  # (household, user, *, today)


def _fmt_qty(value) -> str:
    """Compact decimal (2.000 -> "2", 1.500 -> "1.5")."""
    try:
        d = Decimal(str(value)).normalize()
    except Exception:  # noqa: BLE001
        return str(value)
    text = format(d, "f")
    return text


# --- Tasks (core) -------------------------------------------------------------


def collect_tasks(household, user, *, today: date) -> DigestSection | None:
    from tasks.models import Task

    active = [Task.Status.PENDING, Task.Status.IN_PROGRESS, Task.Status.BACKLOG]
    qs = (
        Task.objects.filter(
            household=household,
            due_date__isnull=False,
            due_date__lte=today,
            status__in=active,
        )
        # A private task is only ever the concern of the user who owns it.
        .filter(Q(is_private=False) | Q(created_by=user))
        .order_by("due_date")
    )
    tasks = list(qs[:20])
    if not tasks:
        return None

    lines: list[str] = []
    for t in tasks:
        if t.due_date == today:
            lines.append(_("Today: %(subject)s") % {"subject": t.subject})
        else:
            lines.append(_("Overdue: %(subject)s") % {"subject": t.subject})
    title = _("%(count)s task(s) to handle") % {"count": len(tasks)}
    return DigestSection("tasks", "✅", title, lines)


# --- Weather (module: weather) ------------------------------------------------


def collect_weather(household, user, *, today: date) -> DigestSection | None:
    from weather.alerts import evaluate_weather_alerts, render_alert_line

    alerts = evaluate_weather_alerts(household)
    if not alerts:
        return None
    seen: set = set()
    lines: list[str] = []
    for alert in alerts:
        if alert["kind"] in seen:
            continue
        seen.add(alert["kind"])
        lines.append(render_alert_line(alert))  # already carries its own emoji
    return DigestSection("weather", "⚠️", _("Weather to watch"), lines)


# --- Stock (module: stock) ----------------------------------------------------


def collect_stock(household, user, *, today: date) -> DigestSection | None:
    from stock.models import StockItem

    items = list(
        StockItem.objects.filter(
            household=household,
            status__in=[StockItem.Status.LOW_STOCK, StockItem.Status.OUT_OF_STOCK],
        ).order_by("name")[:20]
    )
    if not items:
        return None
    lines: list[str] = []
    for it in items:
        if it.status == StockItem.Status.OUT_OF_STOCK:
            lines.append(_("%(name)s — out of stock") % {"name": it.name})
        else:
            lines.append(
                _("%(name)s — low (%(qty)s %(unit)s)")
                % {"name": it.name, "qty": _fmt_qty(it.quantity), "unit": it.unit}
            )
    return DigestSection("stock", "📦", _("Stock to restock"), lines)


# --- Electricity (module: electricity) ----------------------------------------


def collect_electricity(household, user, *, today: date) -> DigestSection | None:
    """Flag an anomaly when the last 30 days of consumption exceed the previous
    30 by more than ``DIGEST_ELEC_ANOMALY_THRESHOLD`` (default 30%).

    A 30-day rolling window (vs the naive month-to-date) avoids the false
    positive of comparing a partial month to a full one, and needs a prior full
    window of data before it says anything.
    """
    from electricity.models import ElectricityMeter
    from electricity.services import consumption_summary

    meters = list(ElectricityMeter.objects.filter(household=household))
    if not meters:
        return None

    cur_from = today - timedelta(days=29)
    prev_from = today - timedelta(days=59)
    prev_to = today - timedelta(days=30)
    cur_wh = prev_wh = 0
    for meter in meters:
        try:
            cur = consumption_summary(
                household, meter, granularity="day", date_from=cur_from, date_to=today
            )
            prev = consumption_summary(
                household, meter, granularity="day", date_from=prev_from, date_to=prev_to
            )
        except Exception:  # noqa: BLE001 — one bad meter never sinks the section
            logger.exception("digest: electricity summary failed for meter %s", meter.pk)
            continue
        cur_wh += cur.get("total_wh") or 0
        prev_wh += prev.get("total_wh") or 0

    if prev_wh <= 0 or cur_wh <= 0:
        return None  # not enough history to compare — stay silent

    threshold = float(getattr(settings, "DIGEST_ELEC_ANOMALY_THRESHOLD", 0.30))
    ratio = cur_wh / prev_wh
    if ratio < 1 + threshold:
        return None
    pct = round((ratio - 1) * 100)
    line = _(
        "Consumption up %(pct)s%% over the last 30 days vs the previous 30"
    ) % {"pct": pct}
    return DigestSection("electricity", "⚡", _("Electricity anomaly"), [line])


# --- Chickens (module: chickens) ----------------------------------------------


def collect_chickens(household, user, *, today: date) -> DigestSection | None:
    from chickens.services import egg_stats

    stats = egg_stats(household, today=today)
    avg_7 = stats.get("avg_7d")
    avg_30 = stats.get("avg_30d")
    if not avg_7 or not avg_30:
        return None
    # Only flag a meaningful drop (>20% below the 30-day baseline).
    if avg_7 >= avg_30 * 0.8:
        return None
    line = _(
        "Laying down: %(a7)s eggs/day (7-day avg) vs %(a30)s (30-day avg)"
    ) % {"a7": avg_7, "a30": avg_30}
    return DigestSection("chickens", "🥚", _("Egg laying dropped"), [line])


# --- Registry -----------------------------------------------------------------

SECTION_SPECS: tuple[SectionSpec, ...] = (
    SectionSpec("tasks", None, collect_tasks),
    SectionSpec("weather", "weather", collect_weather),
    SectionSpec("stock", "stock", collect_stock),
    SectionSpec("electricity", "electricity", collect_electricity),
    SectionSpec("chickens", "chickens", collect_chickens),
)

SECTION_KEYS: tuple[str, ...] = tuple(spec.key for spec in SECTION_SPECS)
