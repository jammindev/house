"""The telegram_set_commands management command + BOT_COMMANDS source of truth."""
from __future__ import annotations

import pytest
from django.core.management import call_command

from telegram.service import BOT_COMMANDS

pytestmark = pytest.mark.django_db


def _pushed_by_language(bot):
    """Map language_code (None for default) -> the commands list pushed."""
    out = {}
    for call in bot.set_my_commands.call_args_list:
        out[call.kwargs.get("language_code")] = call.args[0]
    return out


class TestBotCommandsSourceOfTruth:
    def test_commands_mirror_the_handlers(self):
        # Guard against BOT_COMMANDS drifting from what _handle_message accepts.
        names = {name for name, _ in BOT_COMMANDS}
        assert names == {"help", "reset", "stop"}

    def test_start_is_not_listed(self):
        # /start is Telegram's built-in Start button, never in the menu.
        assert "start" not in {name for name, _ in BOT_COMMANDS}


class TestSetCommandsCommand:
    def test_pushes_default_plus_one_list_per_language(self, bot):
        call_command("telegram_set_commands")
        pushed = _pushed_by_language(bot)
        # default (None) + fr/de/es. en rides on the default list.
        assert set(pushed) == {None, "fr", "de", "es"}

    def test_each_list_has_every_command(self, bot):
        call_command("telegram_set_commands")
        for commands in _pushed_by_language(bot).values():
            assert [c["command"] for c in commands] == [n for n, _ in BOT_COMMANDS]
            assert all(c["description"] for c in commands)

    def test_descriptions_are_localized(self, bot):
        call_command("telegram_set_commands")
        pushed = _pushed_by_language(bot)
        default = {c["command"]: c["description"] for c in pushed[None]}
        french = {c["command"]: c["description"] for c in pushed["fr"]}
        assert default["stop"] == "Turn off proactive messages"
        assert french["stop"] == "Couper les messages proactifs"

    def test_skips_cleanly_when_channel_is_off(self, bot, settings):
        settings.TELEGRAM_BOT_TOKEN = ""
        call_command("telegram_set_commands")
        bot.set_my_commands.assert_not_called()

    def test_partial_failure_does_not_raise(self, bot):
        # A rejected push (client returns None) must be surfaced, not fatal.
        bot.set_my_commands.return_value = None
        call_command("telegram_set_commands")
        assert bot.set_my_commands.called
