from django.urls import path

from .views_web import (
    AppEquipmentStockDetailView,
    AppEquipmentStockEditView,
    AppEquipmentStockNewView,
    AppEquipmentStockView,
)

urlpatterns = [
    path("", AppEquipmentStockView.as_view(), name="app_equipment_stock"),
    path("new/", AppEquipmentStockNewView.as_view(), name="app_equipment_stock_new"),
    path("<uuid:item_id>/", AppEquipmentStockDetailView.as_view(), name="app_equipment_stock_detail"),
    path("<uuid:item_id>/edit/", AppEquipmentStockEditView.as_view(), name="app_equipment_stock_edit"),
]
