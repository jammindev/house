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
            build_search_household_tool,
            register,
        )

        register(build_search_household_tool())
        register(build_get_entity_tool())
        register(build_get_related_tool())
        register(build_create_entity_tool())
