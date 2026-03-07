from django.urls import path

from .views_web import (
    AppStockDetailView,
    AppStockEditView,
    AppStockNewView,
    AppStockView,
)

urlpatterns = [
    path("", AppStockView.as_view(), name="app_stock"),
    path("new/", AppStockNewView.as_view(), name="app_stock_new"),
    path("<uuid:item_id>/", AppStockDetailView.as_view(), name="app_stock_detail"),
    path("<uuid:item_id>/edit/", AppStockEditView.as_view(), name="app_stock_edit"),
]
