"""Banking admin registration."""
from django.contrib import admin

from .models import BankAccount, BankTransaction, StatementImport


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "household", "kind", "bank_label", "currency", "archived")
    list_filter = ("kind", "archived", "household")
    search_fields = ("name", "bank_label")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(StatementImport)
class StatementImportAdmin(admin.ModelAdmin):
    list_display = (
        "filename",
        "account",
        "provider",
        "status",
        "created_count",
        "skipped_count",
        "created_at",
    )
    list_filter = ("status", "provider", "household")
    search_fields = ("filename", "error")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(BankTransaction)
class BankTransactionAdmin(admin.ModelAdmin):
    list_display = ("booked_on", "account", "amount", "direction", "is_internal", "label_raw")
    list_filter = ("direction", "is_internal", "account", "household")
    search_fields = ("label_norm", "external_id", "notes")
    date_hierarchy = "booked_on"
    # label_raw / amount / dedup_hash are `editable=False` or immutable by
    # contract — the admin must not become the back door that rewrites a
    # statement.
    readonly_fields = ("id", "label_raw", "label_norm", "dedup_hash", "created_at", "updated_at")
