"""
Proactive-ping services — single source of truth for preferences and the tick.

``send_due_pings`` is THE scheduler entry point (management command
``send_scheduled_pings``, run every few minutes by the ``scheduler`` container).
It is deliberately dumb-scheduler-friendly: idempotent (``PingLog`` unique
constraint claimed before sending), catch-up (a missed tick sends on the next
pass), and per-preference fault-isolated (one failing household never blocks
the others).

The outbound message is a template rendered in the recipient's language — no
LLM call happens here. The LLM only enters when the user replies, through the
regular Telegram → ``agent.service.ask`` pipeline.
"""
from __future__ import annotations

import logging
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone, translation

from telegram.models import TelegramAccount

from . import registry
from .models import PingLog, PingPreference

logger = logging.getLogger(__name__)


def available_pings(household, user) -> list[dict]:
    """Registry specs the household may use, merged with the user's preferences.

    Shape consumed by the settings UI: every listed ping always has ``enabled``
    and ``send_at`` (spec defaults when the user never touched it).
    """
    prefs = {
        p.ping_type: p
        for p in PingPreference.objects.filter(household=household, user=user)
    }
    rows = []
    for spec in registry.specs_for_household(household):
        pref = prefs.get(spec.ping_type)
        rows.append(
            {
                "ping_type": spec.ping_type,
                "module": spec.module,
                "enabled": pref.enabled if pref else False,
                "send_at": pref.send_at if pref else spec.default_send_at,
            }
        )
    return rows


def upsert_preference(
    household, user, *, ping_type: str, enabled: bool, send_at=None
) -> PingPreference:
    """Create or update the (household, user, ping_type) preference row.

    Raises ``LookupError`` for a ping type that is unknown or whose module the
    household disabled — the view maps that to a 404.
    """
    spec = registry.find_spec(ping_type)
    if spec is None or spec not in registry.specs_for_household(household):
        raise LookupError(f"unknown or disabled ping_type: {ping_type}")

    defaults = {"enabled": enabled, "updated_by": user}
    if send_at is not None:
        defaults["send_at"] = send_at
    pref, _created = PingPreference.objects.update_or_create(
        household=household,
        user=user,
        ping_type=ping_type,
        defaults=defaults,
        create_defaults={
            **defaults,
            "send_at": send_at if send_at is not None else spec.default_send_at,
            "created_by": user,
        },
    )
    return pref


def send_due_pings(now: datetime | None = None) -> dict:
    """One scheduler tick: send every enabled ping whose local time has passed.

    Returns a ``{"sent", "skipped", "errors"}`` summary for the command's log
    line. Never raises for a single bad preference.
    """
    now = now or timezone.now()
    sent = skipped = errors = 0

    prefs = PingPreference.objects.filter(enabled=True).select_related(
        "user", "household"
    )
    for pref in prefs:
        try:
            if _send_one(pref, now):
                sent += 1
            else:
                skipped += 1
        except Exception:  # noqa: BLE001 — isolate failures per preference
            errors += 1
            logger.exception(
                "pings.tick failed for %s/%s", pref.ping_type, pref.user_id
            )

    if sent or errors:
        logger.info("pings.tick: sent=%s skipped=%s errors=%s", sent, skipped, errors)
    return {"sent": sent, "skipped": skipped, "errors": errors}


def _send_one(pref: PingPreference, now: datetime) -> bool:
    """Evaluate one preference; send if due. True = a message went out.

    A due ping fans out to every channel the user can receive on: Telegram (the
    original channel, which also persists the question as an agent turn so a
    reply keeps context) and Web Push. The ping counts as sent as soon as *one*
    channel delivers; if none do, the claimed ``PingLog`` slot is released so a
    later tick retries.
    """
    spec = registry.find_spec(pref.ping_type)
    if spec is None:
        return False  # stale row for an unregistered type
    household = pref.household
    if spec not in registry.specs_for_household(household):
        return False  # module disabled since the opt-in

    local_now = now.astimezone(_household_tz(household))
    today = local_now.date()
    if local_now.time() < pref.send_at:
        return False  # not due yet

    if PingLog.objects.filter(
        household=household, user=pref.user, ping_type=pref.ping_type, sent_on=today
    ).exists():
        return False  # already sent today

    with translation.override(_recipient_language(pref)):
        text = spec.build_message(household, pref.user, today=today)
        if not text:
            return False  # nothing worth asking today (data already entered…)

        # Claim the (day, ping) slot BEFORE sending: overlapping ticks race on
        # the unique constraint, not on a channel. A total delivery failure
        # releases the claim so the next tick retries.
        log, created = PingLog.objects.get_or_create(
            household=household,
            user=pref.user,
            ping_type=pref.ping_type,
            sent_on=today,
            defaults={"created_by": pref.user},
        )
        if not created:
            return False

        if not _deliver(pref.user, household, text):
            log.delete()
            return False
    return True


def _deliver(user, household, text: str) -> bool:
    """Fan a ping out to every available channel. True if any delivered."""
    delivered = False

    account = (
        TelegramAccount.objects.filter(user=user).select_related("user").first()
    )
    if account is not None:
        from telegram.outbound import send_agent_message

        # Telegram also persists the question as an agent turn (reply pipeline).
        if send_agent_message(account, household, text):
            delivered = True

    from webpush.service import send_web_push

    # Best-effort, never raises; no-op (0) if the user has no subscription.
    if send_web_push(user, str(household), text, url="/app/dashboard") > 0:
        delivered = True

    return delivered


def _household_tz(household) -> ZoneInfo:
    name = getattr(household, "timezone", "") or "UTC"
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning("pings: invalid household timezone %r, using UTC", name)
        return ZoneInfo("UTC")


def _recipient_language(pref: PingPreference) -> str:
    """User locale, falling back to the household language — same semantics as
    the Telegram channel's ``_account_language``."""
    if pref.user.locale:
        return pref.user.locale
    return pref.household.preferred_language or "en"
