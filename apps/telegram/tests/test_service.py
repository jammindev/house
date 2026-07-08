"""Update routing: /start linking, unknown chats, /help."""
from __future__ import annotations

import pytest

from telegram import service
from telegram.linking import make_link_token
from telegram.models import TelegramAccount

from .conftest import text_update

pytestmark = pytest.mark.django_db


def _sent_texts(bot) -> list[str]:
    return [call.args[1] for call in bot.send_message.call_args_list]


class TestStart:
    def test_valid_token_links_account(self, bot, user, household):
        token = make_link_token(user)
        service.handle_update(text_update(555, f"/start {token}"))
        account = TelegramAccount.objects.get(user=user)
        assert account.chat_id == 555
        assert account.username == "benj"
        assert bot.send_message.call_count == 1

    def test_invalid_token_replies_error_without_linking(self, bot, user):
        service.handle_update(text_update(555, "/start not-a-real-token"))
        assert not TelegramAccount.objects.exists()
        assert bot.send_message.call_count == 1

    def test_bare_start_on_unlinked_chat_replies_not_linked(self, bot, db):
        service.handle_update(text_update(555, "/start"))
        assert bot.send_message.call_count == 1

    def test_bare_start_on_linked_chat_replies_help(self, bot, linked_account):
        service.handle_update(text_update(linked_account.chat_id, "/start"))
        assert bot.send_message.call_count == 1


class TestUnknownChat:
    def test_text_from_unknown_chat_gets_fixed_reply(self, bot, db):
        service.handle_update(text_update(999, "combien j'ai payé la VMC ?"))
        assert bot.send_message.call_count == 1

    def test_no_reply_without_chat_or_text(self, bot, db):
        service.handle_update({"update_id": 5, "message": {"chat": {}, "text": "hi"}})
        service.handle_update({"update_id": 6, "message": {"chat": {"id": 1}, "text": ""}})
        bot.send_message.assert_not_called()

    def test_localized_reply_uses_telegram_language_hint(self, bot, db):
        update = text_update(999, "hola", sender={"id": 999, "language_code": "es"})
        service.handle_update(update)
        assert bot.send_message.call_count == 1


class TestHelp:
    def test_help_on_linked_chat(self, bot, linked_account):
        service.handle_update(text_update(linked_account.chat_id, "/help"))
        assert bot.send_message.call_count == 1
