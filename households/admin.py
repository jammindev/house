"""
Households admin configuration.
"""
from django.contrib import admin
from .models import Household, HouseholdMember


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    """Admin for Household model."""
    list_display = ['name', 'city', 'country', 'created_at', 'default_household']
    list_filter = ['country', 'city', 'default_household', 'created_at']
    search_fields = ['name', 'city', 'country', 'inbound_email_alias']
    readonly_fields = ['id', 'created_at', 'inbound_email_alias']
    
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
        ('Settings', {
            'fields': ('default_household',)
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
