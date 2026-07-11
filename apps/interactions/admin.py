"""
Interactions admin configuration.
"""
from django.contrib import admin
from .models import Interaction, InteractionZone


class InteractionZoneInline(admin.TabularInline):
    model = InteractionZone
    extra = 1
    autocomplete_fields = ['zone']


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ['subject', 'type', 'is_private', 'occurred_at', 'household', 'created_by']
    list_filter = ['type', 'is_private', 'household', 'occurred_at', 'created_at']
    search_fields = ['subject', 'content', 'enriched_text', 'tags__tag__name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    inlines = [InteractionZoneInline]
    
    fieldsets = [
        ('Basic Info', {
            'fields': ['household', 'subject', 'content', 'type', 'is_private']
        }),
        ('Timeline', {
            'fields': ['occurred_at']
        }),
        ('Metadata', {
            'fields': ['metadata', 'enriched_text'],
            'classes': ['collapse']
        }),
        ('Audit', {
            'fields': ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
            'classes': ['collapse']
        }),
    ]


@admin.register(InteractionZone)
class InteractionZoneAdmin(admin.ModelAdmin):
    list_display = ['interaction', 'zone']
    list_filter = ['zone__household']
    autocomplete_fields = ['interaction', 'zone']
