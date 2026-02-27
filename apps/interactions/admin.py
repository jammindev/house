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
    list_display = ['subject', 'type', 'status', 'occurred_at', 'household', 'created_by']
    list_filter = ['type', 'status', 'household', 'occurred_at', 'created_at']
    search_fields = ['subject', 'content', 'enriched_text', 'tags']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    # autocomplete_fields = ['project']  # TODO: Uncomment after projects app
    inlines = [InteractionZoneInline]
    
    fieldsets = [
        ('Basic Info', {
            'fields': ['household', 'subject', 'content', 'type', 'status']
        }),
        ('Timeline', {
            'fields': ['occurred_at', 'tags']
        }),
        ('Metadata', {
            'fields': ['metadata', 'enriched_text'],
            'classes': ['collapse']
        }),
        # ('Relations', {  # TODO: Uncomment after projects
        #     'fields': ['project']
        # }),
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
