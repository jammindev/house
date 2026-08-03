from django.apps import AppConfig


class TelegramConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "telegram"
    verbose_name = "Telegram"

    def ready(self):
        from app_settings.capabilities import CapabilitySpec, register

        from .capabilities import telegram_available

        register(CapabilitySpec(
            key="telegram",
            available=telegram_available,
            doc_anchor="telegram-bot",
            env_vars=("TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME"),
        ))
