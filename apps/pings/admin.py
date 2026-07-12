from django.contrib import admin

from .models import PingLog, PingPreference


@admin.register(PingPreference)
class PingPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "household", "ping_type", "enabled", "send_at")
    list_filter = ("ping_type", "enabled")


@admin.register(PingLog)
class PingLogAdmin(admin.ModelAdmin):
    list_display = ("user", "household", "ping_type", "sent_on", "created_at")
    list_filter = ("ping_type",)
    date_hierarchy = "sent_on"
