"""
Notifications — user-scoped in-app notifications.
"""
import uuid
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model

User = get_user_model()


class Notification(models.Model):
    """
    A user-scoped in-app notification.
    Generic: type + JSON payload so new notification types don't need migrations.
    """

    class Type(models.TextChoices):
        HOUSEHOLD_INVITATION = "household_invitation", _("Household invitation")
        HOUSEHOLD_MEMBER_JOINED = "household_member_joined", _("New household member")
        STOCK_LOW = "stock_low", _("Low stock")
        STOCK_OUT = "stock_out", _("Out of stock")
        WEATHER_ALERT = "weather_alert", _("Weather alert")
        CHICKEN_CHORE_DUE = "chicken_chore_due", _("Coop chore due")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_column="user_id",
    )
    type = models.CharField(max_length=64, choices=Type.choices)
    title = models.CharField(max_length=255)
    body = models.TextField(default="", blank=True)
    payload = models.JSONField(default=dict, blank=True)
    url = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text=_(
            "In-app path this notification leads to. Per-row and not per-type: "
            "'Bob finished Mow the lawn' points at that task, which a map keyed "
            "by type cannot express."
        ),
    )
    dedup_key = models.CharField(
        max_length=200,
        blank=True,
        default="",
        db_index=True,
        help_text=_(
            "Caller-chosen identity of the fact announced. A second notification "
            "with the same (user, type, key) is skipped while the first is alive."
        ),
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="notif_user_created_idx"),
            models.Index(fields=["user", "is_read"], name="notif_user_read_idx"),
        ]

    def __str__(self):
        return f"[{self.type}] {self.title} → {self.user.email}"

    @property
    def is_mutable(self) -> bool:
        return self.type in MUTABLE_TYPES

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])


# Types a user is allowed to silence, and by omission the ones they are not.
#
# The distinction is deliberate: some notifications are the only way to learn
# something actionable — an invitation nobody else can accept for you, a member
# who now has access to the household's data. Letting a checkbox hide those
# turns a preference into a trap, and the user would have no way to know what
# they stopped receiving.
#
# Everything frequent and merely informative belongs here. The "somebody did
# something" family to come (a task ticked, an expense logged) is the reason
# this set exists: ~60 a week in a family of four, and a bell that becomes
# noise loses the rare notification that mattered along with the rest.
MUTABLE_TYPES = frozenset({
    Notification.Type.STOCK_LOW,
    Notification.Type.STOCK_OUT,
    Notification.Type.WEATHER_ALERT,
    # A coop chore is recurring by definition: silencing it must stay possible,
    # or the reminder that helps for a month becomes the one that trains the
    # household to ignore the bell.
    Notification.Type.CHICKEN_CHORE_DUE,
})
