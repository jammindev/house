from django.contrib import admin

from .models import TelegramAccount


@admin.register(TelegramAccount)
class TelegramAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "chat_id", "username", "linked_at")
    search_fields = ("user__email", "username", "chat_id")
    readonly_fields = ("chat_id", "linked_at", "created_at", "updated_at")
