"""
Notification service — single entry point for creating and managing notifications.
Transport-agnostic: swap polling for WebSocket later by editing only this file.
"""
import logging

from django.utils import timezone

from .models import Notification

logger = logging.getLogger(__name__)

# HTMX event name broadcast on the body to refresh the bell widget.
# Used in both Django views (HX-Trigger header) and React (dispatchEvent).
BELL_REFRESH_EVENT = "bellRefresh"

# Deep-link a push notification opens when tapped, per notification type. The
# service worker falls back to /app/dashboard for anything unmapped, so this map
# only needs the types that have a more specific landing page.
_DEEP_LINKS = {
    Notification.Type.STOCK_LOW: "/app/stock",
    Notification.Type.STOCK_OUT: "/app/stock",
    Notification.Type.HOUSEHOLD_INVITATION: "/app/dashboard",
}


def send(
    user,
    notification_type: str,
    title: str,
    body: str = "",
    payload: dict | None = None,
) -> Notification:
    """
    Create and persist a notification for a user.
    All callers (households, projects, etc.) go through here.

    Also mirrors the notification to Web Push (best-effort): a user with a push
    subscription gets it on their device even when the SPA is closed. The push
    carries the current unread count so the PWA can set its app-icon badge.
    """
    notif = Notification.objects.create(
        user=user,
        type=notification_type,
        title=title,
        body=body,
        payload=payload or {},
    )
    _mirror_to_web_push(notif)
    # Future: channel_layer.group_send(f"user_{user.id}", {...}) here for WS
    return notif


def _mirror_to_web_push(notif: Notification) -> None:
    """Fire the notification to the user's push subscriptions. Never raises."""
    try:
        from webpush.service import send_web_push

        unread = Notification.objects.filter(
            user=notif.user, is_read=False, deleted_at__isnull=True
        ).count()
        send_web_push(
            notif.user,
            notif.title,
            notif.body,
            url=_DEEP_LINKS.get(notif.type, "/app/dashboard"),
            tag=notif.type,
            data={"unreadCount": unread},
        )
    except Exception:  # noqa: BLE001 — push must never break notification creation
        logger.exception("web push mirror failed for notification %s", notif.id)


# Keep legacy alias so existing callers don't break
create_notification = send


def mark_read_by_payload(user, notification_type: str, **payload_filters) -> int:
    """
    Mark notifications as read by payload field values.
    Returns the number of notifications updated.

    Example:
        mark_read_by_payload(
            user, "household_invitation", invitation_id=str(invitation.id)
        )
    """
    filters = {f"payload__{k}": v for k, v in payload_filters.items()}
    return Notification.objects.filter(
        user=user,
        type=notification_type,
        is_read=False,
        deleted_at__isnull=True,
        **filters,
    ).update(is_read=True, read_at=timezone.now())
