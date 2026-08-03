from django.apps import AppConfig


class WebpushConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "webpush"
    verbose_name = "Web Push"

    def ready(self):
        from app_settings.capabilities import CapabilitySpec, register

        from .capabilities import push_available

        register(CapabilitySpec(
            key="push",
            available=push_available,
            doc_anchor="push-notifications-vapid",
            env_vars=("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_ADMIN_EMAIL"),
        ))
