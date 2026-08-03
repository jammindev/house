from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        from app_settings.capabilities import CapabilitySpec, register

        from .capabilities import email_available

        register(CapabilitySpec(
            key="email",
            available=email_available,
            doc_anchor="email-smtp",
            env_vars=("EMAIL_HOST", "EMAIL_HOST_USER", "EMAIL_HOST_PASSWORD"),
        ))
