"""
Proactive ping of the chicken coop: the evening egg-count question.

Registered as ``PingSpec('egg_log')`` from ``apps.py::ready()``. The user's
reply flows through the regular Telegram → ``agent.service.ask`` pipeline and
lands in ``services.log_eggs`` via the existing ``egg_log`` writable — the
upsert makes a second answer the same evening replace the count, never
duplicate it.
"""
from __future__ import annotations

from datetime import date

from django.utils.translation import gettext as _

from .models import Chicken, EggLog


def build_egg_ping(household, user, *, today: date) -> str | None:
    """The evening question, or ``None`` when there is nothing to ask.

    Skips when the flock is empty (nothing to collect) and when today's count
    is already logged (from the app or an earlier reply) — the ping must never
    ask for data the household already entered.
    """
    if not Chicken.objects.filter(
        household=household, status__in=Chicken.FLOCK_STATUSES
    ).exists():
        return None
    if EggLog.objects.filter(household=household, date=today).exists():
        return None
    return _("🥚 How many eggs did you collect today?")
