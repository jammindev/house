"""Briefing write services — single source of truth.

Both the REST viewset and (in later lots) the agent go through these functions so
validation (via ``BriefingSerializer``) and the active-briefings quota live in one
place — never two write paths, never raw ORM in a handler. Mirrors
``shopping.services`` / ``tasks.services``.
"""
from __future__ import annotations

from rest_framework import serializers

from .models import Briefing
from .serializers import BriefingSerializer

# Anti-cost guard: each active briefing costs one agent run per scheduled slot,
# so we cap how many a single user can keep running at once (parcours 23 cadrage).
MAX_ACTIVE_BRIEFINGS_PER_USER = 10


def _assert_active_quota(household, user, *, exclude_pk=None) -> None:
    """Raise a validation error if activating would exceed the per-user cap."""
    qs = Briefing.objects.filter(
        household_id=household.id, created_by=user, is_active=True
    )
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    if qs.count() >= MAX_ACTIVE_BRIEFINGS_PER_USER:
        raise serializers.ValidationError(
            {
                "is_active": (
                    f"You can keep at most {MAX_ACTIVE_BRIEFINGS_PER_USER} "
                    "active briefings."
                )
            }
        )


def create_briefing(
    household,
    user,
    *,
    title: str,
    prompt: str,
    condition: str = "",
    channel: str = Briefing.Channel.TELEGRAM,
    briefing_type: str = Briefing.Type.RECURRING,
    is_private: bool = False,
    is_active: bool = False,
) -> Briefing:
    """Create one briefing rule. Validation goes through the serializer."""
    if is_active:
        _assert_active_quota(household, user)

    payload = {
        "title": title,
        "prompt": prompt,
        "condition": condition or "",
        "channel": channel,
        "briefing_type": briefing_type,
        "is_private": bool(is_private),
        "is_active": bool(is_active),
    }
    serializer = BriefingSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


def update_briefing(household, user, briefing: Briefing, *, fields: dict) -> Briefing:
    """Update a briefing — shared by the REST PATCH and (later) the agent tool."""
    allowed = {
        "title",
        "prompt",
        "condition",
        "channel",
        "briefing_type",
        "is_private",
        "is_active",
    }
    payload = {k: v for k, v in fields.items() if k in allowed}

    # Only re-check the quota when this write turns the briefing ON.
    turning_on = payload.get("is_active") and not briefing.is_active
    if turning_on:
        _assert_active_quota(household, user, exclude_pk=briefing.pk)

    serializer = BriefingSerializer(briefing, data=payload, partial=True)
    serializer.is_valid(raise_exception=True)
    return serializer.save(updated_by=user)


def delete_briefing(briefing: Briefing) -> None:
    briefing.delete()


def resolve_briefing(household, raw_id) -> Briefing | None:
    """Household-scoped briefing lookup for update/delete."""
    return Briefing.objects.filter(household_id=household.id, pk=raw_id).first()
