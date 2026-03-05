"""
Documents admin configuration.
"""
from urllib.parse import quote

from django.conf import settings
from django.contrib import admin
from django.utils.html import format_html

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'file_link', 'household', 'interaction', 'created_by', 'created_at']
    list_filter = ['type', 'household', 'created_at']
    search_fields = ['name', 'notes', 'ocr_text', 'file_path']
    readonly_fields = ['id', 'file_link', 'created_at', 'created_by', 'updated_at', 'updated_by']
    
    fieldsets = [
        ('Basic Info', {
            'fields': ['household', 'name', 'type', 'notes']
        }),
        ('File Info', {
            'fields': ['file_path', 'file_link', 'mime_type']
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

    @admin.display(description='File link')
    def file_link(self, obj):
        if not obj.file_path:
            return "-"

        normalized = obj.file_path.strip().lstrip('/')
        if not normalized:
            return "-"

        encoded_path = "/".join(quote(part, safe="") for part in normalized.split('/'))
        media_url = settings.MEDIA_URL.rstrip('/')
        url = f"{media_url}/{encoded_path}"
        return format_html('<a href="{}" target="_blank" rel="noopener noreferrer">{}</a>', url, url)
