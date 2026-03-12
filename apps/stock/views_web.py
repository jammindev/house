from django.shortcuts import get_object_or_404
from django.urls import reverse

from core.permissions import resolve_selected_household
from core.views import ReactPageView
from zones.models import Zone
from zones.serializers import ZonePickerSerializer

from .models import StockCategory, StockItem
from .serializers import StockCategoryPickerSerializer


def _zones_props(request, selected_household):
    qs = Zone.objects.for_user_households(request.user).select_related("parent")
    if selected_household:
        qs = qs.filter(household=selected_household)
    return ZonePickerSerializer(qs.order_by("name"), many=True).data


def _categories_props(request, selected_household):
    qs = StockCategory.objects.for_user_households(request.user)
    if selected_household:
        qs = qs.filter(household=selected_household)
    return StockCategoryPickerSerializer(qs.order_by("sort_order", "name"), many=True).data


class AppStockView(ReactPageView):
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
        selected_household = resolve_selected_household(self.request)
        return {
            "mode": "create",
            "initialZones": _zones_props(self.request, selected_household),
            "initialCategories": _categories_props(self.request, selected_household),
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
        selected_household = resolve_selected_household(self.request)
        household = selected_household or item.household
        return {
            "mode": "edit",
            "itemId": str(item.id),
            "initialZones": _zones_props(self.request, household),
            "initialCategories": _categories_props(self.request, household),
            "cancelUrl": reverse("app_stock_detail", kwargs={"item_id": item.id}),
            "successRedirectUrl": reverse("app_stock_detail", kwargs={"item_id": item.id}),
        }
