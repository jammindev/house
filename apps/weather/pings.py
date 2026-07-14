"""
Proactive weather-alert ping (parcours 17, Lot 4).

Registered as ``PingSpec('weather_alert')`` from ``apps.py::ready()``. Reuses the
existing ping scheduler (``send_scheduled_pings`` tick, ``PingLog`` idempotence,
per-user opt-in via ``PingPreference``) — no new cron.

``build_message`` evaluates the shared alert evaluator (``weather.alerts``); when
an alert fires it also drops an in-app notification (the "bell" channel) before
returning the Telegram text. Both are deduped to once per day: the ping by
``PingLog``, the notification by a same-day existence check (so a Telegram send
retry doesn't create a second bell entry).
"""
from __future__ import annotations

from datetime import date

from .alerts import evaluate_weather_alerts, render_alert_message

# Notification.type discriminator for the in-app bell (literal, no enum change).
NOTIFICATION_TYPE = "weather_alert"


def build_weather_alert_ping(household, user, *, today: date) -> str | None:
    """Return the localized alert message, or ``None`` when nothing is at risk.

    Side effect on a firing alert: create an in-app notification for ``user``
    (idempotent per day). Called inside the user's language context, so the
    evaluator's rendered text is localized.
    """
    alerts = evaluate_weather_alerts(household)
    message = render_alert_message(alerts)
    if message is None:
        return None

    _notify_bell(household, user, today, alerts, message)
    return message


def _notify_bell(household, user, today: date, alerts: list[dict], message: str) -> None:
    from django.utils.translation import gettext as _

    from notifications.models import Notification
    from notifications.service import send

    # Idempotence keyed on the household-local day (not created_at, whose server
    # timezone could disagree with `today` around midnight).
    day = today.isoformat()
    already = Notification.objects.filter(
        user=user,
        type=NOTIFICATION_TYPE,
        payload__day=day,
        deleted_at__isnull=True,
    ).exists()
    if already:
        return

    send(
        user,
        NOTIFICATION_TYPE,
        title=_("Weather alert"),
        body=message,
        payload={
            "household_id": str(household.id),
            "day": day,
            "kinds": sorted({a["kind"] for a in alerts}),
        },
    )
