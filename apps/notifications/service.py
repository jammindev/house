"""
Notification service — single entry point for creating notifications.
Transport-agnostic: swap polling for WebSocket later by editing only this file.
"""
from .models import Notification


def create_notification(
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
