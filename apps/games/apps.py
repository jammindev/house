from django.apps import AppConfig


class GamesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'games'
    verbose_name = 'Jeux du foyer'

    def ready(self):
        # Capacité optionnelle (parcours 31, lot 3) — l'aide à l'écriture des
        # énigmes. L'app qui possède le réglage possède sa déclaration :
        # `app_settings` ne connaît pas la liste.
        from app_settings.capabilities import CapabilitySpec, register as register_capability

        from .capabilities import riddles_available

        register_capability(CapabilitySpec(
            key="hunt_riddles",
            available=riddles_available,
            doc_anchor="assistant-anthropic",
            env_vars=("ANTHROPIC_API_KEY",),
        ))
