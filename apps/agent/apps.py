from django.apps import AppConfig


class AgentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "agent"

    def ready(self):
        # Register the agent's built-in tools. Kept here (not at import time) so
        # the registry is populated once the app registry is ready.
        from .tools import (
            build_create_entity_tool,
            build_get_entity_tool,
            build_get_related_tool,
            build_list_entities_tool,
            build_manage_memory_tool,
            build_search_household_tool,
            build_update_entity_tool,
            register,
        )

        register(build_search_household_tool())
        register(build_list_entities_tool())
        register(build_get_entity_tool())
        register(build_get_related_tool())
        register(build_create_entity_tool())
        register(build_update_entity_tool())
        register(build_manage_memory_tool())

        # Proactive daily digest (parcours 19) — the agent "speaks first".
        # Reuses the pings scheduler + Telegram delivery; the message is composed
        # from cross-module signals in ``agent.digest``.
        from datetime import time as dt_time

        from pings.registry import PingSpec, register as register_ping

        from .digest import DIGEST_PING_TYPE
        from .digest.ping import build_daily_digest_message

        register_ping(
            PingSpec(
                ping_type=DIGEST_PING_TYPE,
                build_message=build_daily_digest_message,
                default_send_at=dt_time(7, 30),
                module=None,  # core: aggregates whatever modules are enabled
            )
        )
