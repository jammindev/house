from django.contrib import admin

from .models import Tracker, TrackerEntry


class TrackerEntryInline(admin.TabularInline):
    model = TrackerEntry
    extra = 0
    fields = ('value', 'occurred_at', 'note', 'created_by')
    readonly_fields = ('created_by',)
    ordering = ('-occurred_at',)


@admin.register(Tracker)
class TrackerAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'unit', 'household', 'project', 'last_value', 'last_entry_at', 'is_active',
    )
    list_filter = ('is_active',)
    search_fields = ('name', 'description')
    readonly_fields = (
        'last_value', 'last_entry_at', 'entries_summary',
        'created_at', 'updated_at', 'created_by', 'updated_by',
    )
    inlines = [TrackerEntryInline]
    fieldsets = (
        (None, {'fields': ('household', 'name', 'description', 'unit', 'emoji', 'is_active')}),
        ('Relations', {'fields': ('project', 'target_content_type', 'target_object_id')}),
        ('Cache', {'fields': ('last_value', 'last_entry_at', 'entries_summary'), 'classes': ('collapse',)}),
        ('Audit', {'fields': ('created_at', 'updated_at', 'created_by', 'updated_by'), 'classes': ('collapse',)}),
    )


@admin.register(TrackerEntry)
class TrackerEntryAdmin(admin.ModelAdmin):
    list_display = ('tracker', 'value', 'occurred_at', 'household')
    search_fields = ('tracker__name', 'note')
    ordering = ('-occurred_at',)
