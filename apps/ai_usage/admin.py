from django.contrib import admin

from .models import AIUsageLog


@admin.register(AIUsageLog)
class AIUsageLogAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "feature",
        "provider",
        "model",
        "household",
        "user",
        "success",
        "duration_ms",
        "input_tokens",
        "output_tokens",
    )
    list_filter = ("feature", "provider", "model", "success")
    search_fields = ("household__name", "user__email", "error_type")
    readonly_fields = tuple(f.name for f in AIUsageLog._meta.fields)
    date_hierarchy = "created_at"
