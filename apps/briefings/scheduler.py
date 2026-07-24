"""Scheduler tick for briefings — the automatic send loop (lot 3).

``send_due_briefings`` is THE entry point of the ``send_due_briefings``
management command (run every few minutes by its scheduler container). It mirrors
the pings tick's contract:

- **idempotent**: a ``BriefingSendLog`` row for (briefing, recipient, local day,
  time slot) is claimed via ``get_or_create`` before delivery, so two overlapping
  ticks can never double-send the same slot;
- **catch-up**: a slot whose local time has passed is still sent on the next
  tick that day (until it succeeds/errs once);
- **fault-isolated**: one failing briefing or recipient never blocks the rest;
- **cost-bounded**: one attempt per slot per recipient per day (a persistent
  failure is recorded as ``error`` and not retried), and a recipient without a
  linked Telegram account is skipped *without* an agent run.

Condition evaluation (lot 4) will slot in just before generation; today an active,
due briefing always sends.
"""
from __future__ import annotations

import logging
from datetime import datetime

from django.utils import timezone, translation

from .conditions import evaluate_condition
from .generation import (
    _recipient_language,
    _recipients,
    _render_telegram,
    generate_briefing_text,
)
from .models import Briefing, BriefingSendLog
from .schedule import household_tz

logger = logging.getLogger(__name__)


def send_due_briefings(now: datetime | None = None) -> dict:
    """One scheduler tick: send every active briefing whose local slot has passed.

    Returns a ``{"sent", "skipped_no_telegram", "errors"}`` summary. Never raises
    for a single bad briefing.
    """
    now = now or timezone.now()
    totals = {"sent": 0, "skipped_no_telegram": 0, "skipped_condition": 0, "errors": 0}

    briefings = Briefing.objects.filter(is_active=True).select_related("household", "created_by")
    for briefing in briefings:
        try:
            outcome = _send_one_briefing(briefing, now)
        except Exception:  # noqa: BLE001 — isolate failures per briefing
            totals["errors"] += 1
            logger.exception("briefings.tick failed for briefing=%s", briefing.pk)
            continue
        for key in totals:
            totals[key] += outcome[key]

    if totals["sent"] or totals["errors"] or totals["skipped_condition"]:
        logger.info(
            "briefings.tick: sent=%s skipped_no_telegram=%s skipped_condition=%s errors=%s",
            totals["sent"],
            totals["skipped_no_telegram"],
            totals["skipped_condition"],
            totals["errors"],
        )
    return totals


def _send_one_briefing(briefing: Briefing, now: datetime) -> dict:
    """Evaluate one briefing's due slots for today and deliver them."""
    totals = {"sent": 0, "skipped_no_telegram": 0, "skipped_condition": 0, "errors": 0}

    if not briefing.send_times:
        return totals

    tz = household_tz(briefing.household)
    local_now = now.astimezone(tz)
    today = local_now.date()

    # Weekday gate: empty weekdays = every day.
    if briefing.weekdays and today.weekday() not in briefing.weekdays:
        return totals

    recipients = _recipients(briefing)
    outcome_to_key = {
        "sent": "sent",
        "skipped_no_telegram": "skipped_no_telegram",
        "skipped_condition": "skipped_condition",
        "error": "errors",
    }

    for slot in sorted(briefing.send_times):
        if local_now.time() < slot:
            continue  # not due yet today
        for user in recipients:
            outcome = _deliver_slot(briefing, user, today, slot)
            key = outcome_to_key.get(outcome)
            if key:
                totals[key] += 1

    return totals


def _deliver_slot(briefing: Briefing, user, slot_date, slot_time) -> str:
    """Deliver one (recipient, slot) exactly once. Returns the outcome label."""
    from telegram.models import TelegramAccount
    from telegram.outbound import send_agent_message

    account = TelegramAccount.objects.filter(user=user).first()
    if account is None:
        # No claim, no agent run — so the user still gets it if they link today.
        return "skipped_no_telegram"

    # Claim the slot pessimistically (status=error) BEFORE the costly work, so an
    # overlapping tick loses the race and a crash mid-send never double-sends.
    log, created = BriefingSendLog.objects.get_or_create(
        briefing=briefing,
        user=user,
        slot_date=slot_date,
        slot_time=slot_time,
        defaults={
            "household": briefing.household,
            "status": BriefingSendLog.Status.ERROR,
            "created_by": user,
        },
    )
    if not created:
        return "noop"  # already attempted this slot today

    try:
        # Condition gate (lot 4): an unconditional briefing always sends; a
        # condition that is false (or unevaluable) skips this slot, recorded so
        # it is not re-evaluated today.
        verdict = evaluate_condition(briefing, recipient=user)
        if not verdict.send:
            log.status = BriefingSendLog.Status.SKIPPED_CONDITION
            log.content = verdict.reason
            log.save(update_fields=["status", "content", "updated_at"])
            return "skipped_condition"

        with translation.override(_recipient_language(user, briefing.household)):
            text = generate_briefing_text(briefing, recipient=user)
            payload = _render_telegram(briefing, text)
        if send_agent_message(account, briefing.household, payload):
            log.status = BriefingSendLog.Status.SENT
            log.content = text
            log.save(update_fields=["status", "content", "updated_at"])
            return "sent"
    except Exception:  # noqa: BLE001 — recorded as error, not retried
        logger.exception(
            "briefings.tick: delivery failed for briefing=%s user=%s",
            briefing.pk,
            user.pk,
        )
    return "error"
