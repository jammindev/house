from django.urls import path

from .views_web import (
    app_equipment_stock_detail_view,
    app_equipment_stock_edit_view,
    app_equipment_stock_new_view,
    app_equipment_stock_view,
)

urlpatterns = [
    path("", app_equipment_stock_view, name="app_equipment_stock"),
    path("new/", app_equipment_stock_new_view, name="app_equipment_stock_new"),
    path("<uuid:item_id>/", app_equipment_stock_detail_view, name="app_equipment_stock_detail"),
    path("<uuid:item_id>/edit/", app_equipment_stock_edit_view, name="app_equipment_stock_edit"),
]
