"""Aggregation of household alerts (overdue tasks, expiring warranties, due
maintenances, low/out/expired stock)."""

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

STOCK_ALERT_STATUSES = [
    StockItem.Status.LOW_STOCK,
    StockItem.Status.OUT_OF_STOCK,
    StockItem.Status.EXPIRED,
]
# Being out of an item (or keeping an expired one) needs action now; low is a heads-up.
STOCK_CRITICAL_STATUSES = {StockItem.Status.OUT_OF_STOCK, StockItem.Status.EXPIRED}


def _overdue_tasks(household, today: date) -> list[dict]:
    qs = (
        Task.objects.filter(household=household, due_date__lt=today)
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


def build_alerts_summary(household, today: date | None = None) -> dict:
    today = today or timezone.localdate()
    overdue_tasks = _overdue_tasks(household, today)
    expiring_warranties = _expiring_warranties(household, today)
    due_maintenances = _due_maintenances(household, today)
    low_stock = _low_stock(household)
    weather_alerts = _weather_alerts(household)
    return {
        "overdue_tasks": overdue_tasks,
        "expiring_warranties": expiring_warranties,
        "due_maintenances": due_maintenances,
        "low_stock": low_stock,
        "weather_alerts": weather_alerts,
        "total": (
            len(overdue_tasks)
            + len(expiring_warranties)
            + len(due_maintenances)
            + len(low_stock)
            + len(weather_alerts)
        ),
    }
