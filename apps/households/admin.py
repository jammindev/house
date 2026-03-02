"""
Households admin configuration.
"""
from django.contrib import admin
from .models import Household, HouseholdMember


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    """Admin for Household model."""
    list_display = ['name', 'city', 'country', 'created_at', 'get_is_archived']
    list_filter = ['country', 'city', 'created_at']
    search_fields = ['name', 'city', 'country', 'inbound_email_alias']
    readonly_fields = ['id', 'created_at', 'inbound_email_alias', 'archived_at']

    @admin.display(boolean=True, description='Archived')
    def get_is_archived(self, obj):
        return obj.is_archived

    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'name', 'created_at')
        }),
        ('Address', {
            'fields': ('address', 'city', 'country')
        }),
        ('AI & Context', {
            'fields': ('context_notes', 'ai_prompt_context'),
            'classes': ('collapse',)
        }),
        ('Email Ingestion', {
            'fields': ('inbound_email_alias',),
            'classes': ('collapse',)
        }),
        ('Archive', {
            'fields': ('archived_at',),
        }),
    )


@admin.register(HouseholdMember)
class HouseholdMemberAdmin(admin.ModelAdmin):
    """Admin for HouseholdMember model."""
    list_display = ['household', 'user_email', 'role']
    list_filter = ['role']
    search_fields = ['household__name', 'user__email']
    raw_id_fields = ['household', 'user']
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'User'
