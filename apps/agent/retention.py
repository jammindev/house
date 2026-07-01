"""
Retention policy for agent conversations.

Conversations accumulate indefinitely otherwise. `delete_stale_conversations`
removes those whose last activity is older than the retention window. "Last
activity" is `last_message_at`, falling back to `created_at` for conversations
that never received a message.
"""
from __future__ import annotations

from datetime import timedelta

from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import AgentConversation


def stale_conversations(retention_days: int):
    """Return the queryset of conversations older than the retention window."""
    cutoff = timezone.now() - timedelta(days=retention_days)
    return (
        AgentConversation.objects.annotate(
            last_activity=Coalesce("last_message_at", "created_at")
        )
        .filter(last_activity__lt=cutoff)
    )


def delete_stale_conversations(retention_days: int, *, dry_run: bool = False) -> int:
    """Delete conversations older than ``retention_days``; return the count.

    ``dry_run`` reports the count without deleting. A non-positive
    ``retention_days`` disables cleanup (returns 0, deletes nothing).
    """
    if retention_days <= 0:
        return 0

    qs = stale_conversations(retention_days)
    count = qs.count()
    if not dry_run and count:
        # Messages cascade via the FK on_delete=CASCADE.
        qs.delete()
    return count
