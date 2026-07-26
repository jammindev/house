"""Banking admin registration."""
from django.contrib import admin

from .models import BankAccount


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "household", "kind", "bank_label", "currency", "archived")
    list_filter = ("kind", "archived", "household")
    search_fields = ("name", "bank_label")
    readonly_fields = ("id", "created_at", "updated_at")
