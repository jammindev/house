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

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
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

    # Schedule (lot 3), interpreted in the household timezone:
    # - ``send_times``: local times of day the briefing fires (one or more).
    # - ``weekdays``: Python weekday ints (Mon=0 … Sun=6) it may fire on;
    #   empty = every day. Both empty ⇒ the briefing never fires automatically.
    send_times = ArrayField(models.TimeField(), default=list, blank=True)
    weekdays = ArrayField(
        models.PositiveSmallIntegerField(), default=list, blank=True
    )

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


class BriefingSendLog(HouseholdScopedModel):
    """One (briefing, recipient, local day, time slot) send — the tick's idempotency lock.

    Claimed before delivery so two overlapping scheduler ticks can never
    double-send the same slot (same pattern as ``pings.PingLog``). It doubles as
    the observable history consumed by lot 5 (``content`` keeps what was sent).
    """

    class Status(models.TextChoices):
        SENT = "sent", _("Sent")
        ERROR = "error", _("Error")
        # lot 4 adds "skipped_condition"; the field is open on purpose.

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    briefing = models.ForeignKey(
        Briefing, on_delete=models.CASCADE, related_name="send_logs"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="briefing_send_logs",
    )
    # Household-local date + time slot the send belongs to (NOT the UTC instant).
    slot_date = models.DateField()
    slot_time = models.TimeField()
    status = models.CharField(max_length=32, choices=Status.choices)
    content = models.TextField(default="", blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "briefing_send_logs"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["briefing", "user", "slot_date", "slot_time"],
                name="uniq_briefing_send_slot",
            )
        ]
        indexes = [
            models.Index(fields=["briefing", "-created_at"], name="idx_bsl_briefing_recent"),
        ]

    def __str__(self) -> str:
        return f"{self.briefing_id} · {self.user_id} · {self.slot_date} {self.slot_time} ({self.status})"
