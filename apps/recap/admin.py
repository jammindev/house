from django.contrib import admin

from .models import HouseholdRecap


@admin.register(HouseholdRecap)
class HouseholdRecapAdmin(admin.ModelAdmin):
    """Read-only: a frozen snapshot must not be editable from the admin.

    Editing ``stats`` by hand would rewrite a closed month, which is the one thing
    the whole design exists to prevent.
    """

    list_display = ("month", "household", "card_count", "created_at")
    list_filter = ("month",)
    search_fields = ("household__name", "month")
    ordering = ("-month",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
