"""Register the bot's webhook URL + secret with Telegram (run once per deploy)."""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from telegram.client import get_client


class Command(BaseCommand):
    help = "Register the Telegram webhook (URL + secret token) for the bot."

    def add_arguments(self, parser):
        parser.add_argument(
            "--url",
            help=(
                "Public webhook URL. Defaults to "
                "<FRONTEND_URL>/api/telegram/webhook/."
            ),
        )

    def handle(self, *args, **options):
        if not settings.TELEGRAM_BOT_TOKEN:
            raise CommandError("TELEGRAM_BOT_TOKEN is not configured.")
        if not settings.TELEGRAM_WEBHOOK_SECRET:
            raise CommandError("TELEGRAM_WEBHOOK_SECRET is not configured.")

        url = options["url"] or f"{settings.FRONTEND_URL.rstrip('/')}/api/telegram/webhook/"
        if not url.startswith("https://"):
            raise CommandError(f"Telegram requires an https webhook URL, got: {url}")

        result = get_client().set_webhook(url, settings.TELEGRAM_WEBHOOK_SECRET)
        if result is None:
            raise CommandError("setWebhook failed — see logs for the Telegram error.")
        self.stdout.write(self.style.SUCCESS(f"Webhook registered: {url}"))
