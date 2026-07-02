"""
Task creation service — single source of truth for "create a task".

Extracted so both the REST API and the agent's ``create_entity`` tool create
tasks the same way: validation through ``TaskSerializer`` and the household root
zone fallback (mirrors ``TaskViewSet.perform_create``). Callers pass an explicit
``household`` + ``user`` (the agent has no ``request``).
"""
from __future__ import annotations

from zones.models import Zone

from .models import Task
from .serializers import TaskSerializer


def _resolve_zone_ids(household, zone_ids) -> list[str]:
    """Return usable zone ids, falling back to the household root zone.

    Tasks require at least one zone; when the caller provides none we attach the
    task to the household's root zone (auto-created per household), exactly like
    ``TaskViewSet.perform_create``.
    """
    if zone_ids:
        return [str(z) for z in zone_ids]
    root = Zone.objects.filter(household=household, parent__isnull=True).first()
    return [str(root.id)] if root is not None else []


def create_task(
    household,
    user,
    *,
    subject: str,
    content: str | None = None,
    due_date=None,
    priority: int | None = None,
    project=None,
    zone_ids=None,
) -> Task:
    """Create a task for ``household`` on behalf of ``user``.

    Reuses ``TaskSerializer`` so validation (private/assignee rules, zone
    membership, priority range) stays in one place. ``project`` and ``zone_ids``
    are optional; with no zone the household root zone is used.
    """
    payload: dict = {
        "subject": subject,
        "zone_ids": _resolve_zone_ids(household, zone_ids),
    }
    if content:
        payload["content"] = content
    if due_date is not None:
        payload["due_date"] = due_date
    if priority is not None:
        payload["priority"] = priority
    if project is not None:
        payload["project"] = getattr(project, "pk", project)

    serializer = TaskSerializer(data=payload, context={"household_id": household.id})
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)
