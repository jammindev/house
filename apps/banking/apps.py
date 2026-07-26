from django.apps import AppConfig


class BankingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "banking"

    # The agent registries (Searchable/Listable) are wired in lot 8 (#391), and
    # deliberately read-only — a bank statement line is not a piece of data a user
    # (or an agent) types in.

    def ready(self):
        """Register the compliance detectors (parcours 26, lot 1).

        Same contribution model as ``agent.searchables``: the registry knows
        nothing, each app declares what it can detect. Adding a mechanism to the
        app therefore means adding its detector — the review rule that keeps the
        orphan catalogue from falling behind the code.
        """
        from .detectors import register_detectors

        register_detectors()
