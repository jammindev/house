"""
Notification service — single entry point for creating and managing notifications.
Transport-agnostic: swap polling for WebSocket later by editing only this file.
"""
from django.utils import timezone

from .models import Notification

# HTMX event name broadcast on the body to refresh the bell widget.
# Used in both Django views (HX-Trigger header) and React (dispatchEvent).
BELL_REFRESH_EVENT = "bellRefresh"


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
    """
    notif = Notification.objects.create(
        user=user,
        type=notification_type,
        title=title,
        body=body,
        payload=payload or {},
    )
    # Future: channel_layer.group_send(f"user_{user.id}", {...}) here for WS
    return notif


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
