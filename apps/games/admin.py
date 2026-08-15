from django.contrib import admin

from .models import Hunt, HuntStep


class HuntStepInline(admin.TabularInline):
    model = HuntStep
    extra = 0
    fields = ('position', 'zone', 'riddle', 'found_at')


@admin.register(Hunt)
class HuntAdmin(admin.ModelAdmin):
    list_display = ('name', 'household', 'status', 'started_at', 'finished_at')
    list_filter = ('status',)
    search_fields = ('name',)
    inlines = [HuntStepInline]
