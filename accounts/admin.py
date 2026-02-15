from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User, Household, HouseholdMember


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "display_name", "first_name", "last_name", "locale", "is_staff", "is_active")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "display_name", "locale", "avatar_url")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "display_name", "locale", "is_staff", "is_superuser"),
            },
        ),
    )
    search_fields = ("email", "first_name", "last_name", "display_name")
    list_filter = ("is_staff", "is_superuser", "is_active", "locale")


class HouseholdMemberInline(admin.TabularInline):
    model = HouseholdMember
    extra = 1
    raw_id_fields = ('user',)


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'country', 'created_at', 'member_count')
    list_filter = ('country', 'city', 'default_household', 'created_at')
    search_fields = ('name', 'address', 'city', 'country', 'inbound_email_alias')
    readonly_fields = ('id', 'created_at')
    inlines = [HouseholdMemberInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'name', 'created_at')
        }),
        ('Location', {
            'fields': ('address', 'city', 'country')
        }),
        ('Context & AI', {
            'fields': ('context_notes', 'ai_prompt_context'),
            'classes': ('collapse',)
        }),
        ('Email Integration', {
            'fields': ('inbound_email_alias', 'default_household'),
            'classes': ('collapse',)
        }),
    )
    
    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Members'


@admin.register(HouseholdMember)
class HouseholdMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'household', 'role', 'joined_at')
    list_filter = ('role', 'joined_at')
    search_fields = ('user__email', 'household__name')
    raw_id_fields = ('user', 'household')
    readonly_fields = ('joined_at',)
