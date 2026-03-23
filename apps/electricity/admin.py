# electricity/admin.py
from django.contrib import admin

from .models import (
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    MaintenanceEvent,
    PlanChangeLog,
    ProtectiveDevice,
    UsagePoint,
)


@admin.register(ElectricityBoard)
class ElectricityBoardAdmin(admin.ModelAdmin):
    list_display = ("label", "name", "household", "supply_type", "is_active", "updated_at")
    list_filter = ("supply_type", "is_active")
    search_fields = ("label", "name", "household__name")


@admin.register(ProtectiveDevice)
class ProtectiveDeviceAdmin(admin.ModelAdmin):
    list_display = ("label", "household", "board", "device_type", "role", "rating_amps", "is_active")
    list_filter = ("device_type", "role", "is_active")
    search_fields = ("label", "household__name", "board__name")


@admin.register(ElectricCircuit)
class ElectricCircuitAdmin(admin.ModelAdmin):
    list_display = ("label", "name", "household", "protective_device", "is_active")
    list_filter = ("is_active",)
    search_fields = ("label", "name", "household__name")


@admin.register(UsagePoint)
class UsagePointAdmin(admin.ModelAdmin):
    list_display = ("label", "name", "kind", "household", "zone")
    list_filter = ("kind",)
    search_fields = ("label", "name", "household__name")


@admin.register(CircuitUsagePointLink)
class CircuitUsagePointLinkAdmin(admin.ModelAdmin):
    list_display = ("circuit", "usage_point", "household", "is_active", "deactivated_at", "deactivated_by")
    list_filter = ("is_active", "deactivated_at")
    search_fields = ("circuit__label", "usage_point__label", "household__name")


@admin.register(PlanChangeLog)
class PlanChangeLogAdmin(admin.ModelAdmin):
    list_display = ("entity_type", "entity_id", "action", "household", "actor", "created_at")
    list_filter = ("entity_type", "action", "household")
    search_fields = ("entity_id", "household__name", "actor__email")


@admin.register(MaintenanceEvent)
class MaintenanceEventAdmin(admin.ModelAdmin):
    list_display = ("event_date", "household", "board", "performed_by", "entity_type")
    list_filter = ("entity_type",)
    search_fields = ("description", "household__name", "board__name")
