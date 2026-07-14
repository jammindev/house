"""Admin for agent conversations — read-oriented, for observability."""
from __future__ import annotations

from django.contrib import admin
from django.db.models import Count

from .models import AgentConversation, AgentMemory, AgentMessage


class ConversationKindFilter(admin.SimpleListFilter):
    """Split conversations by origin — the anchor pair is the discriminator.

    Empty anchor = a plain web conversation; ``channel`` = a messaging channel
    (Telegram…); anything else = anchored to a household entity (a project's
    Assistant tab, etc.). Lets staff isolate, say, all Telegram sessions.
    """

    title = "type"
    parameter_name = "kind"

    def lookups(self, request, model_admin):
        return [
            ("web", "Web"),
            ("channel", "Canal (Telegram…)"),
            ("anchored", "Ancrée à une entité"),
        ]

    def queryset(self, request, queryset):
        if self.value() == "web":
            return queryset.filter(context_entity_type="")
        if self.value() == "channel":
            return queryset.filter(context_entity_type="channel")
        if self.value() == "anchored":
            return queryset.exclude(context_entity_type__in=["", "channel"])
        return queryset


class AgentMessageInline(admin.TabularInline):
    model = AgentMessage
    extra = 0
    fields = ("role", "content", "created_at")
    readonly_fields = ("role", "content", "created_at")
    can_delete = False
    ordering = ("created_at",)


@admin.register(AgentConversation)
class AgentConversationAdmin(admin.ModelAdmin):
    list_display = (
        "__str__",
        "kind",
        "household",
        "created_by",
        "message_count",
        "last_message_at",
        "created_at",
    )
    list_filter = (ConversationKindFilter, "household")
    search_fields = ("title", "id")
    readonly_fields = ("id", "created_at", "updated_at", "last_message_at")
    inlines = [AgentMessageInline]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_message_count=Count("messages"))

    @admin.display(description="Type")
    def kind(self, obj):
        """Human label for the conversation origin (mirrors the filter buckets)."""
        if not obj.context_entity_type:
            return "Web"
        if obj.context_entity_type == "channel":
            # e.g. "Canal · telegram" — the channel name is the object id.
            return f"Canal · {obj.context_object_id}"
        return f"Ancrée · {obj.context_entity_type}"

    @admin.display(description="Messages", ordering="_message_count")
    def message_count(self, obj):
        return obj._message_count


@admin.register(AgentMessage)
class AgentMessageAdmin(admin.ModelAdmin):
    list_display = ("__str__", "conversation", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("content", "conversation__id")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(AgentMemory)
class AgentMemoryAdmin(admin.ModelAdmin):
    list_display = ("__str__", "household", "created_by", "updated_at")
    list_filter = ("household",)
    search_fields = ("content", "created_by__email")
    readonly_fields = ("id", "created_at", "updated_at")
