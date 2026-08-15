from django.contrib import admin

from .models import Harvest, Tree, TreeEvent


@admin.register(Tree)
class TreeAdmin(admin.ModelAdmin):
    list_display = ('name', 'kind', 'species', 'status', 'zone', 'planted_on', 'household')
    list_filter = ('kind', 'status')
    search_fields = ('name', 'species', 'rootstock', 'notes')


@admin.register(TreeEvent)
class TreeEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'type', 'tree', 'occurred_on', 'household')
    list_filter = ('type',)
    search_fields = ('title', 'notes')


@admin.register(Harvest)
class HarvestAdmin(admin.ModelAdmin):
    list_display = ('tree', 'harvested_on', 'quantity', 'unit', 'household')
    list_filter = ('unit',)
    ordering = ('-harvested_on',)
