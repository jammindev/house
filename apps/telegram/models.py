"""
Link between a house user and a Telegram account.

`TelegramAccount` is the single source of identity for the Telegram channel:
an incoming update is trusted only if its `chat_id` matches a row here. The
household is NOT stored — it is resolved per message from the user (active
household, falling back to the first membership), exactly like the web
middleware, so switching household applies to the bot too.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import TimestampedModel


class TelegramAccount(TimestampedModel):
    """One user = one Telegram account; each household member links their own."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="telegram_account",
    )
    chat_id = models.BigIntegerField(unique=True)
    username = models.CharField(max_length=64, blank=True, default="")
    linked_at = models.DateTimeField(default=timezone.now)

    def __str__(self) -> str:
        who = f"@{self.username}" if self.username else self.chat_id
        return f"{self.user} ↔ {who}"
