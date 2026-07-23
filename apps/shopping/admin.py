from django.contrib import admin

from .models import ShoppingListItem, ShoppingSuggestionDismissal


@admin.register(ShoppingSuggestionDismissal)
class ShoppingSuggestionDismissalAdmin(admin.ModelAdmin):
    list_display = ["stock_item", "household", "dismissed_at", "created_by"]
    list_filter = ["household"]
    readonly_fields = ["id", "dismissed_at", "created_at", "updated_at", "created_by", "updated_by"]
    raw_id_fields = ["stock_item"]


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
