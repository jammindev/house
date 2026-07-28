from django.apps import AppConfig


class RecapConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "recap"

    def ready(self):
        from datetime import time

        from pings.registry import PingSpec, register as register_ping

        # The monthly recap teaser: fires on the 1st, points into the app. Opt-in
        # like every ping, and deliberately **off by default** — a user who also
        # enabled the monthly budget report would otherwise get two messages that
        # morning.
        register_ping(PingSpec(
            ping_type="monthly_recap",
            build_message=_build_monthly_recap_message,
            default_send_at=time(9, 0),
        ))


def _build_monthly_recap_message(household, user, *, today):
    """Ping body: last month's recap teaser on the 1st (None otherwise/too thin)."""
    from .ping import build_monthly_recap_message

    return build_monthly_recap_message(household, user, today=today)
