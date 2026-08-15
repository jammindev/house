"""Aggregation of household alerts (overdue tasks, expiring warranties, due
maintenances, low/out-of-stock items)."""

from datetime import date, timedelta

from django.utils import timezone

from equipment.models import Equipment
from equipment.services import compute_next_service_due
from stock.models import StockItem
from tasks.models import Task


ALERT_WARRANTY_DAYS = 90
ALERT_MAINTENANCE_DAYS = 30

OVERDUE_TASK_CRITICAL_DAYS = 3
WARRANTY_CRITICAL_DAYS = 30
MAINTENANCE_CRITICAL_DAYS = 7

# A chore turns critical once it is late by its own period again — a weekly
# chore at 7 days late, a yearly one at a year. A fixed day count cannot serve
# both: 7 days late on "clean the coop" is neglect, on "vermifuger" it is noise.
CHORE_CRITICAL_FACTOR = 1

STOCK_ALERT_STATUSES = [
    StockItem.Status.LOW_STOCK,
    StockItem.Status.OUT_OF_STOCK,
]
# Being out of an item needs action now; low is a heads-up.
STOCK_CRITICAL_STATUSES = {StockItem.Status.OUT_OF_STOCK}


def _overdue_tasks(household, today: date) -> list[dict]:
    # Les tâches privées sont exclues **du compte**, pas masquées à l'affichage.
    #
    # ``build_alerts_summary`` prend un foyer, jamais un lecteur : le résumé est
    # calculé une fois et lu par tout le monde, donc rien dont la visibilité varie
    # selon le lecteur ne peut y entrer. Même raisonnement — et même formulation —
    # que ``tasks.services.completion_summary`` pour le récap mensuel. Sans cette
    # ligne le panneau d'alertes affichait le libellé des tâches privées des
    # autres membres, ce que la liste des tâches, elle, refuse désormais.
    qs = (
        Task.objects.filter(household=household, due_date__lt=today, is_private=False)
        .exclude(status__in=[Task.Status.DONE, Task.Status.ARCHIVED])
        .order_by("due_date", "created_at")
    )
    items = []
    for task in qs:
        days_overdue = (today - task.due_date).days
        items.append(
            {
                "id": str(task.id),
                "title": task.subject,
                "due_date": task.due_date.isoformat(),
                "days_overdue": days_overdue,
                "entity_url": "/app/tasks",
                "severity": "critical" if days_overdue >= OVERDUE_TASK_CRITICAL_DAYS else "warning",
            }
        )
    return items


def _expiring_warranties(household, today: date) -> list[dict]:
    threshold = today + timedelta(days=ALERT_WARRANTY_DAYS)
    qs = (
        Equipment.objects.filter(
            household=household,
            warranty_expires_on__gte=today,
            warranty_expires_on__lte=threshold,
        )
        .order_by("warranty_expires_on")
    )
    items = []
    for equipment in qs:
        days_remaining = (equipment.warranty_expires_on - today).days
        items.append(
            {
                "id": str(equipment.id),
                "title": equipment.name,
                "warranty_expires_on": equipment.warranty_expires_on.isoformat(),
                "days_remaining": days_remaining,
                "entity_url": f"/app/equipment/{equipment.id}",
                "severity": "critical" if days_remaining <= WARRANTY_CRITICAL_DAYS else "warning",
            }
        )
    return items


def _due_maintenances(household, today: date) -> list[dict]:
    threshold = today + timedelta(days=ALERT_MAINTENANCE_DAYS)
    qs = Equipment.objects.filter(
        household=household,
        maintenance_interval_months__isnull=False,
        last_service_at__isnull=False,
    )
    items = []
    for equipment in qs:
        next_due = compute_next_service_due(
            equipment.last_service_at, equipment.maintenance_interval_months
        )
        if next_due is None or next_due < today or next_due > threshold:
            continue
        days_remaining = (next_due - today).days
        items.append(
            {
                "id": str(equipment.id),
                "title": equipment.name,
                "next_service_due": next_due.isoformat(),
                "days_remaining": days_remaining,
                "entity_url": f"/app/equipment/{equipment.id}",
                "severity": (
                    "critical" if days_remaining <= MAINTENANCE_CRITICAL_DAYS else "warning"
                ),
            }
        )
    items.sort(key=lambda item: item["next_service_due"])
    return items


def _low_stock(household) -> list[dict]:
    qs = StockItem.objects.filter(
        household=household, status__in=STOCK_ALERT_STATUSES
    ).order_by("name")
    items = []
    for stock_item in qs:
        items.append(
            {
                "id": str(stock_item.id),
                "title": stock_item.name,
                "status": stock_item.status,
                "quantity": str(stock_item.quantity),
                "min_quantity": (
                    str(stock_item.min_quantity)
                    if stock_item.min_quantity is not None
                    else None
                ),
                "unit": stock_item.unit,
                "entity_url": "/app/stock",
                "severity": (
                    "critical" if stock_item.status in STOCK_CRITICAL_STATUSES else "warning"
                ),
            }
        )
    items.sort(key=lambda item: (item["severity"] != "critical", item["title"].lower()))
    return items


def _weather_alerts(household) -> list[dict]:
    """Weather risks ahead (frost/heatwave/wind/storm) — parcours 17 Lot 4.

    On-read channel of the shared evaluator; rendered client-side from the
    structured fields (kind/value), so no server-side i18n here. Skipped when the
    weather module is disabled for the household (the evaluator already returns
    ``[]`` when no location is set).
    """
    if "weather" in (household.disabled_modules or []):
        return []
    from weather.alerts import evaluate_weather_alerts

    return [
        {
            "kind": alert["kind"],
            "date": alert["date"],
            "value": alert["value"],
            "unit": alert["unit"],
            "entity_url": "/app/weather",
            "severity": alert["severity"],
        }
        for alert in evaluate_weather_alerts(household)
    ]


def _egg_drop_alerts(household, today: date) -> list[dict]:
    """Abnormal egg-laying drop (parcours 14 Lot 6.3), qualified by cause.

    On-read channel of the chickens app's pure evaluator; rendered client-side
    from the structured fields (cause/drop_pct), so no server-side i18n here.
    Skipped when the chickens module is disabled for the household.
    """
    if "chickens" in (household.disabled_modules or []):
        return []
    from chickens.alerts import evaluate_egg_drop_alert

    alert = evaluate_egg_drop_alert(household, today)
    return [alert] if alert is not None else []


def _due_chores(household, today: date) -> list[dict]:
    """Recurring coop chores whose due date has passed.

    Reads ``chickens.services.overdue_chores`` — the very function the reminder
    ping reads. The dashboard and the notification must never be able to
    disagree about what is late; recomputing "en retard" here would be a second
    definition of the same verdict.
    """
    if "chickens" in (household.disabled_modules or []):
        return []
    from chickens.services import overdue_chores

    items = []
    for chore, state in overdue_chores(household, today=today):
        items.append(
            {
                "id": str(chore.id),
                "title": chore.name,
                "emoji": chore.emoji,
                "interval_days": chore.interval_days,
                "next_due_on": state["next_due_on"].isoformat(),
                "days_overdue": state["days_overdue"],
                "never_done": state["never_done"],
                "entity_url": f"/app/chickens?chore={chore.id}",
                "severity": (
                    "critical"
                    if state["days_overdue"] >= CHORE_CRITICAL_FACTOR * chore.interval_days
                    else "warning"
                ),
            }
        )
    return items


def _due_orchard_care(household, today: date) -> list[dict]:
    """Seasonal care windows open or already shut, one row per (rule, subject).

    A kind-scoped rule is **not** one alert but one per subject: having pruned
    one of five apple trees does not make the season done, and folding them into
    a single flag would let four trees go unpruned behind a green tick.

    `missed` is critical and `due` is a warning — a shut window cannot be caught
    up, which is exactly why it is the one worth saying out loud.
    """
    from orchard.queries import rule_states

    items = []
    for state in rule_states(household, today=today):
        if state["state"] not in ("due", "missed"):
            continue
        rule, tree = state["rule"], state["tree"]
        items.append(
            {
                "id": f"{rule.id}:{tree.id}",
                "title": f"{rule.name} — {tree.name}",
                "window_end": state["window_end"].isoformat(),
                "state": state["state"],
                "entity_url": f"/app/orchard/{tree.id}",
                "severity": "critical" if state["state"] == "missed" else "warning",
            }
        )
    return items


def build_alerts_summary(household, today: date | None = None) -> dict:
    today = today or timezone.localdate()
    overdue_tasks = _overdue_tasks(household, today)
    expiring_warranties = _expiring_warranties(household, today)
    due_maintenances = _due_maintenances(household, today)
    low_stock = _low_stock(household)
    weather_alerts = _weather_alerts(household)
    egg_drop_alerts = _egg_drop_alerts(household, today)
    due_chores = _due_chores(household, today)
    due_orchard_care = _due_orchard_care(household, today)
    return {
        "overdue_tasks": overdue_tasks,
        "expiring_warranties": expiring_warranties,
        "due_maintenances": due_maintenances,
        "low_stock": low_stock,
        "weather_alerts": weather_alerts,
        "egg_drop_alerts": egg_drop_alerts,
        "due_chores": due_chores,
        "due_orchard_care": due_orchard_care,
        "total": (
            len(overdue_tasks)
            + len(expiring_warranties)
            + len(due_maintenances)
            + len(low_stock)
            + len(weather_alerts)
            + len(egg_drop_alerts)
            + len(due_chores)
            + len(due_orchard_care)
        ),
    }
