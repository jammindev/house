"""
Push the bot's command menu to Telegram (setMyCommands).

Telegram does NOT learn the bot's commands from its behaviour — the `/`
autocomplete is a list you register once with ``setMyCommands`` and Telegram
remembers server-side. So this must be re-run whenever ``BOT_COMMANDS`` changes.
It is wired into the deploy job (``continue-on-error``), which makes the menu
effectively auto-update: edit ``BOT_COMMANDS`` in ``telegram/service.py`` and the
next push to ``main`` propagates it — no manual step. Running it by hand stays
useful for a one-off refresh.

Idempotent: pushing the same list twice is a no-op on Telegram's side.
"""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import translation

from telegram import client as telegram_client
from telegram.service import BOT_COMMANDS, SUPPORTED_LANGUAGES


class Command(BaseCommand):
    help = "Register the bot's command menu (/ autocomplete) with Telegram, per language."

    def handle(self, *args, **options):
        if not settings.TELEGRAM_BOT_TOKEN:
            # Channel intentionally off — skip cleanly so the deploy step stays green.
            self.stdout.write("TELEGRAM_BOT_TOKEN not set — Telegram channel off, skipping.")
            return

        # Resolve get_client through the module (not a bound import) so the test
        # double patched onto telegram.client is picked up at call time.
        client = telegram_client.get_client()
        # The default (language-less) list Telegram serves to any locale without
        # its own — render it in English, the source language.
        languages = ["en", *sorted(SUPPORTED_LANGUAGES - {"en"})]
        failures = []
        for language in languages:
            with translation.override(language):
                commands = [
                    {"command": name, "description": str(description)}
                    for name, description in BOT_COMMANDS
                ]
            # English doubles as the default list (no language_code).
            code = None if language == "en" else language
            if client.set_my_commands(commands, language_code=code) is None:
                failures.append(language)

        if failures:
            # Not a hard error: a partial push must not fail the deploy. Surface it.
            self.stderr.write(
                self.style.WARNING(
                    f"setMyCommands failed for: {', '.join(failures)} — see logs."
                )
            )
        pushed = [lang for lang in languages if lang not in failures]
        self.stdout.write(
            self.style.SUCCESS(
                f"Command menu pushed ({len(BOT_COMMANDS)} commands) for: {', '.join(pushed)}."
            )
        )
