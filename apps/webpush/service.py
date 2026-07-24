"""Web Push delivery — VAPID signing via ``pywebpush``.

Single entry point :func:`send_web_push`. Design contract:

- **Best-effort**: never raises to the caller. A dead browser or a push-service
  error must not break the action that triggered the notification.
- **Self-pruning**: subscriptions the push service reports as gone (HTTP 404/410)
  are deleted automatically.
- **Degrades cleanly**: no-op (returns 0) when VAPID keys are not configured, so
  environments without keys (local, CI) don't error.

This is the *transport* for push. The *content* comes from the notification
sources (``notifications.service.send`` and ``pings``) — see parcours mobile lot 3.
"""
import json
import logging

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    """True when VAPID keys + contact email are set (push can be sent)."""
    return bool(
        getattr(settings, "VAPID_PRIVATE_KEY", "")
        and getattr(settings, "VAPID_ADMIN_EMAIL", "")
    )


def send_web_push(user, title, body="", *, url=None, tag=None, data=None) -> int:
    """Push a notification to every subscription of ``user``.

    Returns the number of subscriptions the push service accepted. Never raises.
    """
    if not is_configured():
        return 0

    from .models import WebPushSubscription

    subs = list(WebPushSubscription.objects.filter(user=user))
    if not subs:
        return 0

    payload = {"title": title, "body": body or ""}
    if url:
        payload["url"] = url
    if tag:
        payload["tag"] = tag
    if data:
        payload.update(data)
    encoded = json.dumps(payload)

    from pywebpush import WebPushException, webpush

    ok_ids = []
    dead_ids = []
    for sub in subs:
        try:
            webpush(
                subscription_info=sub.as_subscription_info(),
                data=encoded,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{settings.VAPID_ADMIN_EMAIL}"},
            )
            ok_ids.append(sub.id)
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in (404, 410):
                dead_ids.append(sub.id)
            else:
                logger.warning("web push failed for sub %s: %s", sub.id, exc)
        except Exception as exc:  # noqa: BLE001 — must never break the caller
            logger.warning("web push error for sub %s: %s", sub.id, exc)

    if ok_ids:
        WebPushSubscription.objects.filter(id__in=ok_ids).update(
            last_success_at=timezone.now()
        )
    if dead_ids:
        WebPushSubscription.objects.filter(id__in=dead_ids).delete()

    return len(ok_ids)
