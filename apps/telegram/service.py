"""
Transport layer: route a Telegram update to the right handler and reply.

No business logic lives here — linking is `linking.py`, questions go through
`agent.service.ask`, exactly the entry point the web API uses. This module
only authenticates the sender (`TelegramAccount`), localizes the bot's own
strings and shuttles text back and forth.

Questions run in a daemon thread: Telegram retries any webhook that doesn't
answer within a few seconds, while `ask()` can take 10–30s with tool calls —
so the webhook returns immediately and the answer arrives as a bot message.
"""
from __future__ import annotations

import logging
import threading

from django.conf import settings
from django.core.cache import cache
from django.db import close_old_connections
from django.utils import translation
from django.utils.translation import gettext as _

from .client import get_client
from .linking import consume_link_token, link_account
from .models import TelegramAccount
from .rendering import render_answer

logger = logging.getLogger(__name__)

# Telegram retries any non-200 delivery, so updates can arrive twice — remember
# recently-seen ids (best effort, per process) and skip replays.
UPDATE_DEDUP_TTL_SECONDS = 15 * 60

SUPPORTED_LANGUAGES = {"en", "fr", "de", "es"}

# Anchor pair identifying THE Telegram conversation of (household, user). The
# anchor fields act as a channel discriminator here — this is not a household
# entity, so it is never passed to `ask()` as context_entity.
CHANNEL_ENTITY_TYPE = "channel"
CHANNEL_OBJECT_ID = "telegram"


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
        if text.startswith("/reset"):
            _handle_reset(account, chat_id)
            return
        _handle_question(account, chat_id, text)


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


def _handle_question(account: TelegramAccount, chat_id: int, text: str) -> None:
    """A free-text message from a linked user → the agent, off-thread."""
    if not _cooldown_ok(chat_id):
        get_client().send_message(
            chat_id,
            _("One question at a time 🙂 — give me a few seconds and try again."),
        )
        return
    _spawn(_process_question, account, chat_id, text)


def _handle_reset(account: TelegramAccount, chat_id: int) -> None:
    """`/reset` — drop the channel conversation, the next message starts fresh.

    Same effect as deleting a conversation from the web sidebar (hard delete,
    messages cascade); the bot recreates one lazily on the next question.
    """
    from agent.models import AgentConversation

    household = _resolve_household(account.user)
    if household is not None:
        AgentConversation.objects.filter(
            household=household,
            created_by=account.user,
            context_entity_type=CHANNEL_ENTITY_TYPE,
            context_object_id=CHANNEL_OBJECT_ID,
        ).delete()
    get_client().send_message(
        chat_id, _("Fresh start — your next message opens a new conversation.")
    )


def _process_question(account: TelegramAccount, chat_id: int, text: str) -> None:
    """Thread body: resolve household/conversation, ask, persist, reply."""
    from agent import service as agent_service
    from agent.conversations import ask_inputs, persist_turns
    from agent.llm import LLMError, LLMTimeoutError
    from agent.models import AgentConversation

    client = get_client()
    try:
        with translation.override(_account_language(account)):
            household = _resolve_household(account.user)
            if household is None:
                client.send_message(
                    chat_id, _("You are not a member of any household yet.")
                )
                return
            client.send_chat_action(chat_id, "typing")
            conversation, _created = AgentConversation.objects.get_or_create(
                household=household,
                created_by=account.user,
                context_entity_type=CHANNEL_ENTITY_TYPE,
                context_object_id=CHANNEL_OBJECT_ID,
            )
            # The channel anchor is a discriminator, not a household entity —
            # history flows, context_entity deliberately does not.
            history, _anchor = ask_inputs(conversation)
            try:
                result = agent_service.ask(
                    text, household, user=account.user, history=history
                )
            except (LLMTimeoutError, LLMError) as exc:
                logger.warning("telegram.ask failed: %s", exc)
                client.send_message(
                    chat_id,
                    _("The assistant is unavailable right now — please try again in a minute."),
                )
                return
            persist_turns(conversation, text, account.user, result)
            _send_answer(client, chat_id, result)
    except Exception:  # noqa: BLE001 — a thread has nobody to re-raise to
        logger.exception("telegram.process_question: unexpected error")
        with translation.override(_account_language(account)):
            client.send_message(
                chat_id, _("Something went wrong on my side — please try again.")
            )


def _send_answer(client, chat_id: int, result) -> None:
    for chunk in render_answer(result, settings.FRONTEND_URL):
        client.send_message(chat_id, chunk)


def _cooldown_ok(chat_id: int) -> bool:
    seconds = settings.TELEGRAM_COOLDOWN_SECONDS
    if seconds <= 0:
        return True
    return bool(cache.add(f"telegram:cooldown:{chat_id}", 1, seconds))


def _spawn(target, *args) -> threading.Thread:
    """Run ``target`` in a daemon thread. Patched to run inline in tests.

    The connection hygiene lives here, not in the targets: each thread gets its
    own DB connections, closed on the way out so they don't leak one per
    question.
    """

    def _runner():
        close_old_connections()
        try:
            target(*args)
        finally:
            close_old_connections()

    thread = threading.Thread(target=_runner, daemon=True)
    thread.start()
    return thread


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
