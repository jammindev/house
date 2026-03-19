from django.contrib import admin
from django.utils.html import format_html

from .models import Task, TaskZone, TaskDocument, TaskInteraction


class TaskDocumentInline(admin.TabularInline):
    model = TaskDocument
    extra = 0
    readonly_fields = ['document_link', 'created_at', 'created_by']
    fields = ['document_link', 'note', 'created_at', 'created_by']

    def document_link(self, obj):
        if obj.document_id:
            return format_html(
                '<a href="/admin/documents/document/{}/change/">{}</a>',
                obj.document_id,
                obj.document.name,
            )
        return '-'
    document_link.short_description = 'Document'


class TaskInteractionInline(admin.TabularInline):
    model = TaskInteraction
    extra = 0
    readonly_fields = ['interaction_link', 'created_at', 'created_by']
    fields = ['interaction_link', 'note', 'created_at', 'created_by']

    def interaction_link(self, obj):
        if obj.interaction_id:
            return format_html(
                '<a href="/admin/interactions/interaction/{}/change/">{}</a>',
                obj.interaction_id,
                obj.interaction.subject,
            )
        return '-'
    interaction_link.short_description = 'Interaction'


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = [
        'subject', 'status', 'priority', 'assigned_to', 'due_date',
        'household', 'created_by', 'doc_count', 'interaction_count',
    ]
    list_filter = ['status', 'priority', 'is_private', 'household', 'due_date']
    search_fields = ['subject', 'content']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    inlines = [TaskDocumentInline, TaskInteractionInline]
    fieldsets = [
        ('Informations', {
            'fields': ['id', 'subject', 'content', 'status', 'priority', 'due_date', 'is_private'],
        }),
        ('Relations', {
            'fields': ['household', 'project', 'assigned_to', 'source_interaction'],
        }),
        ('Completion', {
            'fields': ['completed_by', 'completed_at'],
            'classes': ['collapse'],
        }),
        ('Audit', {
            'fields': ['created_at', 'created_by', 'updated_at', 'updated_by'],
            'classes': ['collapse'],
        }),
    ]

    def doc_count(self, obj):
        return obj.task_documents.count()
    doc_count.short_description = 'Docs'

    def interaction_count(self, obj):
        return obj.task_interactions.count()
    interaction_count.short_description = 'Interactions'


admin.site.register(TaskZone)
