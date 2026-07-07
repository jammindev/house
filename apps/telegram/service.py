"""
Transport layer: route a Telegram update to the right handler and reply.

No business logic lives here — linking is `linking.py`, questions go through
`agent.service.ask` (lot 9b), exactly the entry point the web API uses. This
module only authenticates the sender (`TelegramAccount`), localizes the bot's
own strings and shuttles text back and forth.
"""
from __future__ import annotations

import logging

from django.core.cache import cache
from django.utils import translation
from django.utils.translation import gettext as _

from .client import get_client
from .linking import consume_link_token, link_account
from .models import TelegramAccount

logger = logging.getLogger(__name__)

# Telegram retries any non-200 delivery, so updates can arrive twice — remember
# recently-seen ids (best effort, per process) and skip replays.
UPDATE_DEDUP_TTL_SECONDS = 15 * 60

SUPPORTED_LANGUAGES = {"en", "fr", "de", "es"}


def handle_update(update: dict) -> None:
    """Entry point for the webhook. Must never raise — Telegram would retry."""
    try:
        update_id = update.get("update_id")
        if update_id is not None and not cache.add(
            f"telegram:update:{update_id}", 1, UPDATE_DEDUP_TTL_SECONDS
        ):
            return
        message = update.get("message")
        if isinstance(message, dict):
            _handle_message(message)
    except Exception:  # noqa: BLE001 — a bad update must not 500 the webhook
        logger.exception("telegram.handle_update: unexpected error")


def _handle_message(message: dict) -> None:
    chat_id = (message.get("chat") or {}).get("id")
    text = (message.get("text") or "").strip()
    if chat_id is None or not text:
        return

    if text == "/start" or text.startswith("/start "):
        _handle_start(chat_id, message, text)
        return

    account = (
        TelegramAccount.objects.filter(chat_id=chat_id).select_related("user").first()
    )
    if account is None:
        _reply_not_linked(chat_id, message)
        return

    with translation.override(_account_language(account)):
        if text.startswith("/help"):
            get_client().send_message(chat_id, _help_text())
            return
        _handle_text(account, chat_id, text)


def _handle_start(chat_id: int, message: dict, text: str) -> None:
    """`/start <token>` links the account; a bare `/start` explains the bot."""
    # NB: no throwaway `_` here — it would shadow the gettext alias.
    token = text.partition(" ")[2].strip()
    client = get_client()

    if not token:
        account = TelegramAccount.objects.filter(chat_id=chat_id).select_related("user").first()
        if account is None:
            _reply_not_linked(chat_id, message)
        else:
            with translation.override(_account_language(account)):
                client.send_message(chat_id, _help_text())
        return

    user = consume_link_token(token)
    if user is None:
        with translation.override(_sender_language(message)):
            client.send_message(
                chat_id,
                _("This link is invalid or has expired. Generate a new one from the app settings."),
            )
        return

    account = link_account(user, chat_id, username=(message.get("from") or {}).get("username", ""))
    with translation.override(_account_language(account)):
        client.send_message(
            chat_id,
            _("✅ Your Telegram account is linked. Ask me anything about your home!"),
        )


def _handle_text(account: TelegramAccount, chat_id: int, text: str) -> None:
    """A free-text message from a linked user. The agent bridge lands in lot 9b."""
    get_client().send_message(chat_id, _help_text())


def _reply_not_linked(chat_id: int, message: dict) -> None:
    # Deliberately the same fixed reply for every unlinked chat: no household
    # data, no hint about which accounts exist.
    with translation.override(_sender_language(message)):
        get_client().send_message(
            chat_id,
            _(
                "This Telegram account is not linked to House yet. "
                "Open the app settings and tap “Connect Telegram”."
            ),
        )


def _help_text() -> str:
    return _(
        "Ask me anything about your home — expenses, tasks, equipment, notes…\n"
        "/reset starts a fresh conversation.\n"
        "/help shows this message."
    )


def _account_language(account: TelegramAccount) -> str:
    user = account.user
    if user.locale:
        return user.locale
    household = _resolve_household(user)
    if household is not None:
        return household.preferred_language
    return "en"


def _sender_language(message: dict) -> str:
    """Best-effort language for chats we don't know: Telegram's own hint."""
    code = ((message.get("from") or {}).get("language_code") or "")[:2].lower()
    return code if code in SUPPORTED_LANGUAGES else "en"


def _resolve_household(user):
    """Active household, falling back to the first membership — same semantics
    as the web `ActiveHouseholdMiddleware`."""
    if user.active_household_id:
        return user.active_household
    from households.models import HouseholdMember

    member = (
        HouseholdMember.objects.filter(user=user).select_related("household").first()
    )
    return member.household if member else None
