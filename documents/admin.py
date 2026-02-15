"""
Documents admin configuration.
"""
from django.contrib import admin
from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'household', 'interaction', 'created_by', 'created_at']
    list_filter = ['type', 'household', 'created_at']
    search_fields = ['name', 'notes', 'ocr_text', 'file_path']
    readonly_fields = ['id', 'created_at', 'created_by', 'updated_at', 'updated_by']
    
    fieldsets = [
        ('Basic Info', {
            'fields': ['household', 'name', 'type', 'notes']
        }),
        ('File Info', {
            'fields': ['file_path', 'mime_type']
        }),
        ('Content', {
            'fields': ['ocr_text', 'metadata'],
            'classes': ['collapse']
        }),
        ('Relations', {
            'fields': ['interaction']
        }),
        ('Audit', {
            'fields': ['id', 'created_at', 'created_by', 'updated_at', 'updated_by'],
            'classes': ['collapse']
        }),
    ]
