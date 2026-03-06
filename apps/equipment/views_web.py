from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.generic import TemplateView

from core.permissions import resolve_request_household
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


class AppEquipmentView(LoginRequiredMixin, TemplateView):
    template_name = 'equipment/app/equipment.html'

    def get_context_data(self, **kwargs):
        equipment_list_props = {
            "initialSearch": (self.request.GET.get("search") or "").strip(),
            "initialStatus": (self.request.GET.get("status") or "").strip(),
            "initialZoneId": (self.request.GET.get("zone") or "").strip(),
            "newUrl": reverse("app_equipment_new"),
        }
        return super().get_context_data(equipment_list_props=equipment_list_props, **kwargs)


class AppEquipmentNewView(LoginRequiredMixin, TemplateView):
    template_name = 'equipment/app/equipment_new.html'

    def get_context_data(self, **kwargs):
        selected_household = _resolve_selected_household(self.request)
        equipment_form_props = {
            "mode": "create",
            "initialZones": _zones_payload(self.request, selected_household),
            "initialZonesLoaded": True,
            "cancelUrl": reverse("app_equipment"),
            "successRedirectUrl": reverse("app_equipment"),
        }
        return super().get_context_data(equipment_form_props=equipment_form_props, **kwargs)


class AppEquipmentDetailView(LoginRequiredMixin, TemplateView):
    template_name = 'equipment/app/equipment_detail.html'

    def get_context_data(self, **kwargs):
        equipment = get_object_or_404(
            Equipment.objects.for_user_households(self.request.user).select_related("zone", "created_by", "updated_by"),
            id=self.kwargs["equipment_id"],
        )
        selected_household = _resolve_selected_household(self.request)
        equipment_detail_props = {
            "equipmentId": str(equipment.id),
            "initialZones": _zones_payload(self.request, selected_household or equipment.household),
            "initialZonesLoaded": True,
            "editUrl": reverse("app_equipment_edit", kwargs={"equipment_id": equipment.id}),
            "listUrl": reverse("app_equipment"),
        }
        return super().get_context_data(equipment_detail_props=equipment_detail_props, **kwargs)


class AppEquipmentEditView(LoginRequiredMixin, TemplateView):
    template_name = 'equipment/app/equipment_edit.html'

    def get_context_data(self, **kwargs):
        equipment = get_object_or_404(
            Equipment.objects.for_user_households(self.request.user).select_related("zone"),
            id=self.kwargs["equipment_id"],
        )
        selected_household = _resolve_selected_household(self.request)
        equipment_form_props = {
            "mode": "edit",
            "equipmentId": str(equipment.id),
            "initialZones": _zones_payload(self.request, selected_household or equipment.household),
            "initialZonesLoaded": True,
            "cancelUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
            "successRedirectUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
        }
        return super().get_context_data(equipment_form_props=equipment_form_props, **kwargs)
