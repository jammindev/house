from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from core.permissions import resolve_request_household
from core.views import ReactPageView
from zones.models import Zone

from .models import Equipment


def _resolve_selected_household(request):
    selected_household = resolve_request_household(request, required=False)
    if selected_household:
        return selected_household
    membership = (
        request.user.householdmember_set
        .select_related("household")
        .order_by("household__name")
        .first()
    )
    return membership.household if membership else None


def _zones_payload(request, selected_household):
    zones_queryset = Zone.objects.for_user_households(request.user).select_related("parent")
    if selected_household:
        zones_queryset = zones_queryset.filter(household=selected_household)
    return [
        {
            "id": str(zone.id),
            "name": zone.name,
            "full_path": zone.full_path,
            "color": zone.color,
        }
        for zone in zones_queryset.order_by("name")
    ]


class AppEquipmentView(ReactPageView):
    page_title = _("Equipment")
    page_actions_template = "equipment/partials/_equipment_actions.html"
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
        selected_household = _resolve_selected_household(self.request)
        return {
            "mode": "create",
            "initialZones": _zones_payload(self.request, selected_household),
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
        selected_household = _resolve_selected_household(self.request)
        return {
            "equipmentId": str(equipment.id),
            "initialZones": _zones_payload(self.request, selected_household or equipment.household),
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
        selected_household = _resolve_selected_household(self.request)
        return {
            "mode": "edit",
            "equipmentId": str(equipment.id),
            "initialZones": _zones_payload(self.request, selected_household or equipment.household),
            "initialZonesLoaded": True,
            "cancelUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
            "successRedirectUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
        }


def _resolve_selected_household(request):
    selected_household = resolve_request_household(request, required=False)
    if selected_household:
        return selected_household

    membership = (
        request.user.householdmember_set
        .select_related("household")
        .order_by("household__name")
        .first()
    )
    return membership.household if membership else None


def _zones_payload(request, selected_household):
    zones_queryset = Zone.objects.for_user_households(request.user).select_related("parent")
    if selected_household:
        zones_queryset = zones_queryset.filter(household=selected_household)

    return [
        {
            "id": str(zone.id),
            "name": zone.name,
            "full_path": zone.full_path,
            "color": zone.color,
        }
        for zone in zones_queryset.order_by("name")
    ]

