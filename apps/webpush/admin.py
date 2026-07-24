from django.contrib import admin

from .models import WebPushSubscription


@admin.register(WebPushSubscription)
class WebPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "user_agent", "created_at", "last_success_at")
    search_fields = ("user__email", "endpoint")
    readonly_fields = ("id", "endpoint", "p256dh", "auth", "created_at", "last_success_at")
