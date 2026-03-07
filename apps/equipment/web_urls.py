from django.urls import path

from .views_web import (
    AppEquipmentDetailView,
    AppEquipmentEditView,
    AppEquipmentNewView,
    AppEquipmentView,
)

urlpatterns = [
    path("", AppEquipmentView.as_view(), name="app_equipment"),
    path("new/", AppEquipmentNewView.as_view(), name="app_equipment_new"),
    path("<uuid:equipment_id>/", AppEquipmentDetailView.as_view(), name="app_equipment_detail"),
    path("<uuid:equipment_id>/edit/", AppEquipmentEditView.as_view(), name="app_equipment_edit"),
]
