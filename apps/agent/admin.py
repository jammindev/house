"""Admin for agent conversations — read-oriented, for observability."""
from __future__ import annotations

from django.contrib import admin

from .models import AgentConversation, AgentMessage


class AgentMessageInline(admin.TabularInline):
    model = AgentMessage
    extra = 0
    fields = ("role", "content", "created_at")
    readonly_fields = ("role", "content", "created_at")
    can_delete = False
    ordering = ("created_at",)


@admin.register(AgentConversation)
class AgentConversationAdmin(admin.ModelAdmin):
    list_display = ("__str__", "household", "created_by", "last_message_at", "created_at")
    list_filter = ("household",)
    search_fields = ("title", "id")
    readonly_fields = ("id", "created_at", "updated_at", "last_message_at")
    inlines = [AgentMessageInline]


@admin.register(AgentMessage)
class AgentMessageAdmin(admin.ModelAdmin):
    list_display = ("__str__", "conversation", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("content", "conversation__id")
    readonly_fields = ("id", "created_at", "updated_at")
