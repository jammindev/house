from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.generic import TemplateView

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


class AppEquipmentStockView(LoginRequiredMixin, TemplateView):
    template_name = 'stock/app/stock.html'

    def get_context_data(self, **kwargs):
        stock_list_props = {
            "initialSearch": (self.request.GET.get("search") or "").strip(),
            "initialStatus": (self.request.GET.get("status") or "").strip(),
            "initialZoneId": (self.request.GET.get("zone") or "").strip(),
            "initialCategoryId": (self.request.GET.get("category") or "").strip(),
            "newUrl": reverse("stock:app_equipment_stock_new"),
        }
        return super().get_context_data(stock_list_props=stock_list_props, **kwargs)


class AppEquipmentStockNewView(LoginRequiredMixin, TemplateView):
    template_name = 'stock/app/stock_new.html'

    def get_context_data(self, **kwargs):
        selected_household = _resolve_selected_household(self.request)
        stock_form_props = {
            "mode": "create",
            "initialZones": _zones_payload(self.request, selected_household),
            "initialCategories": _categories_payload(self.request, selected_household),
            "cancelUrl": reverse("stock:app_equipment_stock"),
            "successRedirectUrl": reverse("stock:app_equipment_stock"),
        }
        return super().get_context_data(stock_form_props=stock_form_props, **kwargs)


class AppEquipmentStockDetailView(LoginRequiredMixin, TemplateView):
    template_name = 'stock/app/stock_detail.html'

    def get_context_data(self, **kwargs):
        item = get_object_or_404(
            StockItem.objects.for_user_households(self.request.user).select_related("zone", "category", "created_by", "updated_by"),
            id=self.kwargs["item_id"],
        )
        stock_detail_props = {
            "itemId": str(item.id),
            "editUrl": reverse("stock:app_equipment_stock_edit", kwargs={"item_id": item.id}),
            "listUrl": reverse("stock:app_equipment_stock"),
        }
        return super().get_context_data(stock_detail_props=stock_detail_props, **kwargs)


class AppEquipmentStockEditView(LoginRequiredMixin, TemplateView):
    template_name = 'stock/app/stock_edit.html'

    def get_context_data(self, **kwargs):
        item = get_object_or_404(
            StockItem.objects.for_user_households(self.request.user).select_related("zone", "category"),
            id=self.kwargs["item_id"],
        )
        selected_household = _resolve_selected_household(self.request)
        stock_form_props = {
            "mode": "edit",
            "itemId": str(item.id),
            "initialZones": _zones_payload(self.request, selected_household or item.household),
            "initialCategories": _categories_payload(self.request, selected_household or item.household),
            "cancelUrl": reverse("stock:app_equipment_stock_detail", kwargs={"item_id": item.id}),
            "successRedirectUrl": reverse("stock:app_equipment_stock_detail", kwargs={"item_id": item.id}),
        }
        return super().get_context_data(stock_form_props=stock_form_props, **kwargs)
