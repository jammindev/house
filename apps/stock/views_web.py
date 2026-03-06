from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render
from django.urls import reverse

from core.permissions import resolve_request_household
from zones.models import Zone

from .models import StockCategory, StockItem


def _resolve_selected_household(request):
    selected_household = resolve_request_household(request, required=False)
    if selected_household:
        return selected_household

    membership = request.user.householdmember_set.select_related("household").order_by("household__name").first()
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


def _categories_payload(request, selected_household):
    queryset = StockCategory.objects.for_user_households(request.user)
    if selected_household:
        queryset = queryset.filter(household=selected_household)

    return [
        {
            "id": str(category.id),
            "name": category.name,
            "emoji": category.emoji,
            "color": category.color,
            "description": category.description,
            "sort_order": category.sort_order,
        }
        for category in queryset.order_by("sort_order", "name")
    ]


@login_required
def app_equipment_stock_view(request):
    stock_list_props = {
        "initialSearch": (request.GET.get("search") or "").strip(),
        "initialStatus": (request.GET.get("status") or "").strip(),
        "initialZoneId": (request.GET.get("zone") or "").strip(),
        "initialCategoryId": (request.GET.get("category") or "").strip(),
        "newUrl": reverse("stock:app_equipment_stock_new"),
    }

    return render(
        request,
        "stock/app/stock.html",
        {
            "stock_list_props": stock_list_props,
        },
    )


@login_required
def app_equipment_stock_new_view(request):
    selected_household = _resolve_selected_household(request)

    stock_form_props = {
        "mode": "create",
        "initialZones": _zones_payload(request, selected_household),
        "initialCategories": _categories_payload(request, selected_household),
        "cancelUrl": reverse("stock:app_equipment_stock"),
        "successRedirectUrl": reverse("stock:app_equipment_stock"),
    }

    return render(
        request,
        "stock/app/stock_new.html",
        {
            "stock_form_props": stock_form_props,
        },
    )


@login_required
def app_equipment_stock_detail_view(request, item_id):
    item = get_object_or_404(
        StockItem.objects.for_user_households(request.user).select_related("zone", "category", "created_by", "updated_by"),
        id=item_id,
    )

    stock_detail_props = {
        "itemId": str(item.id),
        "editUrl": reverse("stock:app_equipment_stock_edit", kwargs={"item_id": item.id}),
        "listUrl": reverse("stock:app_equipment_stock"),
    }

    return render(
        request,
        "stock/app/stock_detail.html",
        {
            "stock_detail_props": stock_detail_props,
        },
    )


@login_required
def app_equipment_stock_edit_view(request, item_id):
    item = get_object_or_404(
        StockItem.objects.for_user_households(request.user).select_related("zone", "category"),
        id=item_id,
    )
    selected_household = _resolve_selected_household(request)

    stock_form_props = {
        "mode": "edit",
        "itemId": str(item.id),
        "initialZones": _zones_payload(request, selected_household or item.household),
        "initialCategories": _categories_payload(request, selected_household or item.household),
        "cancelUrl": reverse("stock:app_equipment_stock_detail", kwargs={"item_id": item.id}),
        "successRedirectUrl": reverse("stock:app_equipment_stock_detail", kwargs={"item_id": item.id}),
    }

    return render(
        request,
        "stock/app/stock_edit.html",
        {
            "stock_form_props": stock_form_props,
        },
    )
