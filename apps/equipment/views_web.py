from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render
from django.urls import reverse

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


@login_required
def app_equipment_view(request):
    equipment_list_props = {
        "initialSearch": (request.GET.get("search") or "").strip(),
        "initialStatus": (request.GET.get("status") or "").strip(),
        "initialZoneId": (request.GET.get("zone") or "").strip(),
        "newUrl": reverse("app_equipment_new"),
    }

    return render(
        request,
        'equipment/app/equipment.html',
        {
            "equipment_list_props": equipment_list_props,
        },
    )


@login_required
def app_equipment_new_view(request):
    selected_household = _resolve_selected_household(request)

    equipment_form_props = {
        "mode": "create",
        "initialZones": _zones_payload(request, selected_household),
        "initialZonesLoaded": True,
        "cancelUrl": reverse("app_equipment"),
        "successRedirectUrl": reverse("app_equipment"),
    }

    return render(
        request,
        "equipment/app/equipment_new.html",
        {
            "equipment_form_props": equipment_form_props,
        },
    )


@login_required
def app_equipment_detail_view(request, equipment_id):
    equipment = get_object_or_404(
        Equipment.objects.for_user_households(request.user).select_related("zone", "created_by", "updated_by"),
        id=equipment_id,
    )
    selected_household = _resolve_selected_household(request)

    equipment_detail_props = {
        "equipmentId": str(equipment.id),
        "initialZones": _zones_payload(request, selected_household or equipment.household),
        "initialZonesLoaded": True,
        "editUrl": reverse("app_equipment_edit", kwargs={"equipment_id": equipment.id}),
        "listUrl": reverse("app_equipment"),
    }

    return render(
        request,
        "equipment/app/equipment_detail.html",
        {
            "equipment_detail_props": equipment_detail_props,
        },
    )


@login_required
def app_equipment_edit_view(request, equipment_id):
    equipment = get_object_or_404(
        Equipment.objects.for_user_households(request.user).select_related("zone"),
        id=equipment_id,
    )
    selected_household = _resolve_selected_household(request)

    equipment_form_props = {
        "mode": "edit",
        "equipmentId": str(equipment.id),
        "initialZones": _zones_payload(request, selected_household or equipment.household),
        "initialZonesLoaded": True,
        "cancelUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
        "successRedirectUrl": reverse("app_equipment_detail", kwargs={"equipment_id": equipment.id}),
    }

    return render(
        request,
        "equipment/app/equipment_edit.html",
        {
            "equipment_form_props": equipment_form_props,
        },
    )
