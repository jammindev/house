from django.shortcuts import get_object_or_404
from django.urls import reverse

from core.permissions import resolve_selected_household
from core.views import ReactPageView
from zones.models import Zone
from zones.serializers import ZonePickerSerializer

from .models import Equipment


def _zones_props(request, selected_household):
    qs = Zone.objects.for_user_households(request.user).select_related("parent")
    if selected_household:
        qs = qs.filter(household=selected_household)
    return ZonePickerSerializer(qs.order_by("name"), many=True).data


class AppEquipmentView(ReactPageView):
    react_root_id = "equipment-list-root"
    props_script_id = "equipment-list-props"
    page_vite_asset = "src/pages/equipment/list.tsx"

    def get_props(self):
        return {
            "initialSearch": (self.request.GET.get("search") or "").strip(),
            "initialStatus": (self.request.GET.get("status") or "").strip(),
            "initialZoneId": (self.request.GET.get("zone") or "").strip(),
        }


class AppEquipmentNewView(ReactPageView):
    react_root_id = "equipment-form-root"
    props_script_id = "equipment-form-props"
    page_vite_asset = "src/pages/equipment/new.tsx"

    def get_props(self):
        selected_household = resolve_selected_household(self.request)
        return {
            "mode": "create",
            "initialZones": _zones_props(self.request, selected_household),
            "initialZonesLoaded": True,
            "cancelUrl": reverse("app_equipment"),
            "successRedirectUrl": reverse("app_equipment"),
        }


class AppEquipmentDetailView(ReactPageView):
    react_root_id = "equipment-detail-root"
    props_script_id = "equipment-detail-props"
    page_vite_asset = "src/pages/equipment/detail.tsx"

    def get_props(self):
        equipment = get_object_or_404(
            Equipment.objects.for_user_households(self.request.user).select_related("zone", "created_by", "updated_by"),
            id=self.kwargs["equipment_id"],
        )
        selected_household = resolve_selected_household(self.request)
        return {
            "equipmentId": str(equipment.id),
            "initialZones": _zones_props(self.request, selected_household or equipment.household),
            "initialZonesLoaded": True,
            "editUrl": reverse("app_equipment_edit", kwargs={"equipment_id": equipment.id}),
            "listUrl": reverse("app_equipment"),
        }


class AppEquipmentEditView(ReactPageView):
    react_root_id = "equipment-form-root"
    props_script_id = "equipment-form-props"
    page_vite_asset = "src/pages/equipment/edit.tsx"

    def get_props(self):
        equipment = get_object_or_404(
            Equipment.objects.for_user_households(self.request.user).select_related("zone"),
            id=self.kwargs["equipment_id"],
        )
        selected_household = resolve_selected_household(self.request)
        return {
            "mode": "edit",
            "equipmentId": str(equipment.id),
            "initialZones": _zones_props(self.request, selected_household or equipment.household),
            "initialZonesLoaded": True,
            "cancelUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
            "successRedirectUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
        }
