"""Budget admin registration."""
from django.contrib import admin

from .models import Budget, RecurringExpense


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("name", "household", "monthly_amount", "is_global", "created_at")
    list_filter = ("is_global", "household")
    search_fields = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(RecurringExpense)
class RecurringExpenseAdmin(admin.ModelAdmin):
    list_display = ("label", "household", "amount", "cadence", "next_due_date", "budget")
    list_filter = ("cadence", "household")
    search_fields = ("label", "supplier")
    readonly_fields = ("id", "created_at", "updated_at")
