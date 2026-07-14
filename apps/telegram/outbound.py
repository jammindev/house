"""
Server-initiated Telegram messages (proactive pings).

The inbound flow (`service.py`) always reacts to a webhook update; this module
is the opposite direction: the app speaks first. The message is delivered to
the user's chat AND persisted as an assistant turn in the current session's
channel conversation (`resolve_channel_conversation`) — so when the user
replies, the regular inbound pipeline (`agent.service.ask` + bounded history)
sees the question the bot just asked and can act on the answer with full
context. A ping after a long gap or on a new day opens a fresh session.
"""
from __future__ import annotations

import logging

from django.utils import timezone

from .client import get_client
from .models import TelegramAccount

logger = logging.getLogger(__name__)


def send_agent_message(account: TelegramAccount, household, text: str) -> bool:
    """Push ``text`` to the user's chat and persist it in the channel conversation.

    Returns True only when Telegram accepted the message; on failure (bot
    blocked, channel disabled, network error) nothing is persisted, so the
    conversation never shows a turn the user did not receive. Never raises —
    delivery problems are the caller's signal to retry later, not a crash.
    """
    from agent.conversations import derive_title
    from agent.models import AgentMessage

    from .service import resolve_channel_conversation

    if get_client().send_message(account.chat_id, text) is None:
        logger.warning(
            "telegram.outbound: delivery failed for user=%s", account.user_id
        )
        return False

    conversation = resolve_channel_conversation(household, account.user)
    AgentMessage.objects.create(
        conversation=conversation,
        role=AgentMessage.Role.AGENT,
        content=text,
    )
    conversation.last_message_at = timezone.now()
    if not conversation.title:
        conversation.title = derive_title(text)
    conversation.save(update_fields=["last_message_at", "title", "updated_at"])
    return True
