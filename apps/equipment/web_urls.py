from django.urls import path

from .views_web import (
    app_equipment_detail_view,
    app_equipment_edit_view,
    app_equipment_new_view,
    app_equipment_view,
)

urlpatterns = [
    path("", app_equipment_view, name="app_equipment"),
    path("new/", app_equipment_new_view, name="app_equipment_new"),
    path("<uuid:equipment_id>/", app_equipment_detail_view, name="app_equipment_detail"),
    path("<uuid:equipment_id>/edit/", app_equipment_edit_view, name="app_equipment_edit"),
]
