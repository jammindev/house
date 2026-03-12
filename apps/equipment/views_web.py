from django.shortcuts import get_object_or_404
from django.urls import reverse

from core.views import ReactPageView

from .models import Equipment


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
        return {
            "mode": "create",
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
        return {
            "equipmentId": str(equipment.id),
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
        return {
            "mode": "edit",
            "equipmentId": str(equipment.id),
            "cancelUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
            "successRedirectUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
        }
