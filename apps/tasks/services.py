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


def update_task(household, user, task: Task, *, fields: dict) -> Task:
    """Update ``task`` on behalf of ``user`` — shared by the agent's ``update_entity``.

    Mirrors ``TaskViewSet.perform_update``: same permission rules (the creator
    can edit everything, an assignee only the status) and the same
    ``completed_at`` / ``completed_by`` transitions on status changes.
    Validation goes through ``TaskSerializer`` (partial), like the API.
    """
    from django.utils import timezone
    from rest_framework.exceptions import PermissionDenied

    allowed = {"subject", "content", "status", "due_date", "priority"}
    payload = {k: v for k, v in fields.items() if k in allowed}

    serializer = TaskSerializer(
        task, data=payload, partial=True, context={"household_id": household.id}
    )
    serializer.is_valid(raise_exception=True)
    validated = serializer.validated_data

    user_pk = getattr(user, "pk", None)
    is_creator = task.created_by_id == user_pk
    if not is_creator:
        is_assignee = task.assigned_to_id is not None and task.assigned_to_id == user_pk
        if not is_assignee:
            raise PermissionDenied("Only the creator or assignee can modify this task.")
        if set(validated.keys()) - {"status"}:
            raise PermissionDenied("Assignees can only change the task status.")

    new_status = validated.get("status")
    kwargs: dict = {"updated_by": user}
    if new_status == Task.Status.DONE and not task.completed_at:
        kwargs["completed_at"] = timezone.now()
        kwargs["completed_by"] = user
    elif new_status and new_status != Task.Status.DONE and task.completed_at:
        kwargs["completed_at"] = None
        kwargs["completed_by"] = None
    return serializer.save(**kwargs)
