import uuid

from django.conf import settings
from django.db import models


class WebPushSubscription(models.Model):
    """A browser Web Push subscription belonging to a user's device.

    User-scoped (like ``Notification``) — a user can have several rows (phone,
    laptop…), one per browser ``endpoint``. Dead endpoints (HTTP 404/410 from the
    push service) are pruned automatically on send. See ``webpush.service``.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="webpush_subscriptions",
        db_column="user_id",
    )
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=400, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    last_success_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "webpush_subscriptions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user"], name="webpush_sub_user_idx"),
        ]

    def __str__(self):
        return f"WebPushSubscription({self.user_id})"

    def as_subscription_info(self) -> dict:
        """Shape expected by ``pywebpush.webpush``."""
        return {
            "endpoint": self.endpoint,
            "keys": {"p256dh": self.p256dh, "auth": self.auth},
        }
