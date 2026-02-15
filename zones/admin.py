"""
Zones admin configuration.
"""
from django.contrib import admin
from .models import Zone, ZoneDocument


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    """Admin for Zone model."""
    list_display = ['name', 'household', 'parent', 'surface', 'color', 'depth', 'created_at']
    list_filter = ['household', 'created_at']
    search_fields = ['name', 'note', 'household__name']
    readonly_fields = ['id', 'full_path', 'depth', 'created_at', 'updated_at']
    raw_id_fields = ['household', 'parent', 'created_by', 'updated_by']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'household', 'name', 'parent')
        }),
        ('Details', {
            'fields': ('note', 'surface', 'color')
        }),
        ('Hierarchy', {
            'fields': ('full_path', 'depth'),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ZoneDocument)
class ZoneDocumentAdmin(admin.ModelAdmin):
    """Admin for ZoneDocument model."""
    list_display = ['zone', 'document', 'role', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['zone__name', 'document__name', 'note']
    readonly_fields = ['created_at']
    raw_id_fields = ['zone', 'document', 'created_by']
