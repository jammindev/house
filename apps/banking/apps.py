from django.apps import AppConfig


class BankingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "banking"

    # No ``ready()`` yet: the agent registries (Searchable/Listable) are wired in
    # lot 8 (#391), and deliberately read-only — a bank statement line is not a
    # piece of data a user (or an agent) types in.
