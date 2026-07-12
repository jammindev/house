"""
Proactive-ping persistence: who wants which ping, and what was already sent.

``PingPreference`` is per (household, user, ping_type) — the recipient is a
user, so preferences are personal, but they stay household-scoped because the
question ("how many eggs today?") is about ONE household's data.

``PingLog`` is the idempotence lock of the scheduler tick: one row per
(preference, local day) claimed *before* sending, so two overlapping ticks can
never double-send. It doubles as the observable history of what went out.
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class PingPreference(HouseholdScopedModel):
    """One user's opt-in (default OFF) for one ping type, with a local send time."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ping_preferences",
    )
    ping_type = models.CharField(max_length=64)
    enabled = models.BooleanField(default=False)
    # Local time in the household's timezone (Household.timezone, UTC fallback).
    send_at = models.TimeField()

    objects = HouseholdScopedManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["household", "user", "ping_type"],
                name="uniq_ping_pref_hh_user_type",
            )
        ]

    def __str__(self) -> str:
        state = "on" if self.enabled else "off"
        return f"{self.user} · {self.ping_type} @ {self.send_at} ({state})"


class PingLog(HouseholdScopedModel):
    """One sent ping — the unique constraint is what makes the tick idempotent."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ping_logs",
    )
    ping_type = models.CharField(max_length=64)
    # Household-local date the ping belongs to (NOT the UTC date).
    sent_on = models.DateField()

    objects = HouseholdScopedManager()

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "user", "ping_type", "sent_on"],
                name="uniq_ping_log_hh_user_type_day",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user} · {self.ping_type} · {self.sent_on}"
