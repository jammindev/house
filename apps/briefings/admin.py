from django.contrib import admin

from .models import Briefing, BriefingSendLog


@admin.register(Briefing)
class BriefingAdmin(admin.ModelAdmin):
    list_display = ("title", "household", "created_by", "briefing_type", "is_private", "is_active", "created_at")
    list_filter = ("briefing_type", "is_private", "is_active", "channel")
    search_fields = ("title", "prompt", "condition")
    raw_id_fields = ("household", "created_by", "updated_by")


@admin.register(BriefingSendLog)
class BriefingSendLogAdmin(admin.ModelAdmin):
    list_display = ("briefing", "user", "slot_date", "slot_time", "status", "created_at")
    list_filter = ("status", "slot_date")
    search_fields = ("briefing__title",)
    raw_id_fields = ("briefing", "household", "user", "created_by", "updated_by")
