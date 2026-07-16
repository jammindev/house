from django.contrib import admin

from .models import ShoppingListItem


@admin.register(ShoppingListItem)
class ShoppingListItemAdmin(admin.ModelAdmin):
    list_display = ["label", "quantity", "unit", "checked", "stock_item", "household", "created_by"]
    list_filter = ["household", "checked_at"]
    search_fields = ["label", "note"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]
    raw_id_fields = ["stock_item"]

    @admin.display(boolean=True, description="Checked")
    def checked(self, obj):
        return obj.checked
