from django.contrib import admin

from .models import StockCategory, StockItem, StockLevelReading

admin.site.register(StockCategory)
admin.site.register(StockItem)


@admin.register(StockLevelReading)
class StockLevelReadingAdmin(admin.ModelAdmin):
    list_display = ("stock_item", "reading_at", "quantity", "kind")
    list_filter = ("kind",)
    date_hierarchy = "reading_at"
    raw_id_fields = ("stock_item", "source_interaction")
