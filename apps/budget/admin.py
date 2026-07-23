"""Budget admin registration."""
from django.contrib import admin

from .models import Budget


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("name", "household", "monthly_amount", "is_global", "created_at")
    list_filter = ("is_global", "household")
    search_fields = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")
