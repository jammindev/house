"""
Briefings — user-authored proactive rules the agent renders and pushes.

A ``Briefing`` is the *programmable* successor of the fixed daily digest
(parcours 19): instead of aggregating hardcoded module sections, the user writes,
in natural language, **what** they want (``prompt``), **when** (schedule — added in
lot 3) and optionally **under which condition** (``condition`` — evaluated by the
agent in lot 4). This is a dedicated model, not an ``Interaction``: it carries
state (``is_active``), a machine-readable ``briefing_type`` and per-user
visibility, and it is *queried* by the scheduler — none of which the household
journal expresses (same decision rule as ``Task`` / ``EggLog``).

Visibility reuses the app-wide ``is_private`` convention (see
``core.permissions.CanViewPrivateContent``): a **private** briefing targets only
its creator; a **shared** one targets every household member with Telegram linked.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class Briefing(HouseholdScopedModel):
    """One user-defined proactive briefing rule (creator = ``created_by``)."""

    class Type(models.TextChoices):
        RECURRING = "recurring", _("Recurring")
        EVENT = "event", _("Event-driven")

    class Channel(models.TextChoices):
        TELEGRAM = "telegram", "Telegram"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    title = models.CharField(max_length=200)
    # Natural-language description of the content the agent should compose.
    prompt = models.TextField()
    # Optional natural-language condition the agent evaluates before sending
    # (lot 4). Empty = always send when due.
    condition = models.TextField(default="", blank=True)

    channel = models.CharField(
        max_length=32, choices=Channel.choices, default=Channel.TELEGRAM
    )
    briefing_type = models.CharField(
        max_length=16, choices=Type.choices, default=Type.RECURRING
    )

    # Visibility: private = creator only; shared (default False) = whole household.
    is_private = models.BooleanField(default=False)
    # A briefing stays off until a schedule is set (lot 3) and the user turns it on.
    is_active = models.BooleanField(default=False)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "briefings"
        verbose_name = _("briefing")
        verbose_name_plural = _("briefings")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["household", "is_active"], name="idx_briefing_hh_active"),
            models.Index(fields=["created_by"], name="idx_briefing_creator"),
        ]

    def __str__(self) -> str:
        state = "on" if self.is_active else "off"
        scope = "private" if self.is_private else "shared"
        return f"{self.title} ({scope}, {state})"
