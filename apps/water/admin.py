from django.contrib import admin

from .models import WaterReading


@admin.register(WaterReading)
class WaterReadingAdmin(admin.ModelAdmin):
    list_display = ("reading_date", "index_m3", "household", "created_by")
    search_fields = ("household__name",)
    date_hierarchy = "reading_date"
