from django.contrib import admin

from .models import Chicken, ChickenChore, ChickenEvent, ChickenSettings, EggLog


@admin.register(Chicken)
class ChickenAdmin(admin.ModelAdmin):
    list_display = ('name', 'breed', 'status', 'household', 'acquired_on')
    list_filter = ('status',)
    search_fields = ('name', 'breed', 'notes')


@admin.register(EggLog)
class EggLogAdmin(admin.ModelAdmin):
    list_display = ('date', 'count', 'household')
    ordering = ('-date',)


@admin.register(ChickenEvent)
class ChickenEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'type', 'chicken', 'chore', 'occurred_on', 'household')
    list_filter = ('type',)
    search_fields = ('title', 'notes')


@admin.register(ChickenChore)
class ChickenChoreAdmin(admin.ModelAdmin):
    list_display = ('name', 'interval_days', 'starts_on', 'is_active', 'household')
    list_filter = ('is_active',)
    search_fields = ('name', 'notes')


@admin.register(ChickenSettings)
class ChickenSettingsAdmin(admin.ModelAdmin):
    list_display = ('household', 'feed_stock_item')
