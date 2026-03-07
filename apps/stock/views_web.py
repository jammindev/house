from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from core.permissions import resolve_request_household
from core.views import ReactPageView
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


class AppStockView(ReactPageView):
    page_title = _("Stock")
    page_actions_template = "stock/partials/_stock_actions.html"
    react_root_id = "stock-list-root"
    props_script_id = "stock-list-props"
    page_vite_asset = "src/pages/stock/list.tsx"

    def get_props(self):
        return {
            "initialSearch": (self.request.GET.get("search") or "").strip(),
            "initialStatus": (self.request.GET.get("status") or "").strip(),
            "initialZoneId": (self.request.GET.get("zone") or "").strip(),
            "initialCategoryId": (self.request.GET.get("category") or "").strip(),
            "newUrl": reverse("app_stock_new"),
        }


class AppStockNewView(ReactPageView):
    react_root_id = "stock-form-root"
    props_script_id = "stock-form-props"
    page_vite_asset = "src/pages/stock/new.tsx"

    def get_props(self):
        selected_household = _resolve_selected_household(self.request)
        return {
            "mode": "create",
            "initialZones": _zones_payload(self.request, selected_household),
            "initialCategories": _categories_payload(self.request, selected_household),
            "cancelUrl": reverse("app_stock"),
            "successRedirectUrl": reverse("app_stock"),
        }


class AppStockDetailView(ReactPageView):
    react_root_id = "stock-detail-root"
    props_script_id = "stock-detail-props"
    page_vite_asset = "src/pages/stock/detail.tsx"

    def get_props(self):
        item = get_object_or_404(
            StockItem.objects.for_user_households(self.request.user).select_related("zone", "category", "created_by", "updated_by"),
            id=self.kwargs["item_id"],
        )
        return {
            "itemId": str(item.id),
            "editUrl": reverse("app_stock_edit", kwargs={"item_id": item.id}),
            "listUrl": reverse("app_stock"),
        }


class AppStockEditView(ReactPageView):
    react_root_id = "stock-form-root"
    props_script_id = "stock-form-props"
    page_vite_asset = "src/pages/stock/edit.tsx"

    def get_props(self):
        item = get_object_or_404(
            StockItem.objects.for_user_households(self.request.user).select_related("zone", "category"),
            id=self.kwargs["item_id"],
        )
        selected_household = _resolve_selected_household(self.request)
        return {
            "mode": "edit",
            "itemId": str(item.id),
            "initialZones": _zones_payload(self.request, selected_household or item.household),
            "initialCategories": _categories_payload(self.request, selected_household or item.household),
            "cancelUrl": reverse("app_stock_detail", kwargs={"item_id": item.id}),
            "successRedirectUrl": reverse("app_stock_detail", kwargs={"item_id": item.id}),
        }


