"""Aggregation of household alerts (overdue tasks, expiring warranties, due maintenances)."""

from datetime import date, timedelta

from django.utils import timezone

from equipment.models import Equipment
from equipment.services import compute_next_service_due
from tasks.models import Task


ALERT_WARRANTY_DAYS = 90
ALERT_MAINTENANCE_DAYS = 30

OVERDUE_TASK_CRITICAL_DAYS = 3
WARRANTY_CRITICAL_DAYS = 30
MAINTENANCE_CRITICAL_DAYS = 7


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


def build_alerts_summary(household, today: date | None = None) -> dict:
    today = today or timezone.localdate()
    overdue_tasks = _overdue_tasks(household, today)
    expiring_warranties = _expiring_warranties(household, today)
    due_maintenances = _due_maintenances(household, today)
    return {
        "overdue_tasks": overdue_tasks,
        "expiring_warranties": expiring_warranties,
        "due_maintenances": due_maintenances,
        "total": len(overdue_tasks) + len(expiring_warranties) + len(due_maintenances),
    }
