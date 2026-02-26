# electricity/admin.py
from django.contrib import admin

from .models import (
	Breaker,
	CircuitUsagePointLink,
	ElectricCircuit,
	ElectricityBoard,
	PlanChangeLog,
	ResidualCurrentDevice,
	UsagePoint,
)


@admin.register(ElectricityBoard)
class ElectricityBoardAdmin(admin.ModelAdmin):
	list_display = ("name", "household", "supply_type", "is_active", "updated_at")
	list_filter = ("supply_type", "is_active")
	search_fields = ("name", "household__name")


@admin.register(ResidualCurrentDevice)
class ResidualCurrentDeviceAdmin(admin.ModelAdmin):
	list_display = ("label", "household", "board", "type_code", "rating_amps")
	list_filter = ("type_code",)
	search_fields = ("label", "household__name", "board__name")


@admin.register(Breaker)
class BreakerAdmin(admin.ModelAdmin):
	list_display = ("label", "household", "board", "rating_amps", "curve_type")
	list_filter = ("curve_type",)
	search_fields = ("label", "household__name", "board__name")


@admin.register(ElectricCircuit)
class ElectricCircuitAdmin(admin.ModelAdmin):
	list_display = ("label", "name", "household", "breaker", "phase", "is_active")
	list_filter = ("phase", "is_active")
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
