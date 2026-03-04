from django.urls import path

from .views_web import (
    app_insurance_detail_view,
    app_insurance_edit_view,
    app_insurance_new_view,
    app_insurance_view,
    app_insurance_delete_view,
)

urlpatterns = [
    path("", app_insurance_view, name="app_insurance"),
    path("new/", app_insurance_new_view, name="app_insurance_new"),
    path("<uuid:contract_id>/", app_insurance_detail_view, name="app_insurance_detail"),
    path("<uuid:contract_id>/edit/", app_insurance_edit_view, name="app_insurance_edit"),
    path("<uuid:contract_id>/delete/", app_insurance_delete_view, name="app_insurance_delete"),
]
