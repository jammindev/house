from django.contrib import admin

from .models import ChangelogEntry, ChangelogState


@admin.register(ChangelogEntry)
class ChangelogEntryAdmin(admin.ModelAdmin):
    list_display = ["committed_at", "change_type", "module", "summary", "pr_number"]
    list_filter = ["change_type", "module"]
    search_fields = ["summary", "raw_subject", "commit_sha"]
    readonly_fields = ["created_at"]
    date_hierarchy = "committed_at"


@admin.register(ChangelogState)
class ChangelogStateAdmin(admin.ModelAdmin):
    list_display = ["head_sha", "head_committed_at", "generated_at"]

    def has_add_permission(self, request):
        return False
