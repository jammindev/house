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

        # Ping contextuel (parcours 31, lot 4) — l'invitation du samedi pluvieux.
        # Il monte sur le tick existant (`send_scheduled_pings`), donc pas de
        # nouveau planificateur ; `module='games'` le coupe avec le module.
        from datetime import time as dt_time

        from pings.registry import PingSpec, register as register_ping

        from .pings import build_hunt_suggestion_ping

        register_ping(PingSpec(
            ping_type="hunt_suggestion",
            module="games",
            build_message=build_hunt_suggestion_ping,
            # 10 h : assez tard pour que la maison soit debout, assez tôt pour
            # qu'il reste une matinée à occuper.
            default_send_at=dt_time(10, 0),
        ))
