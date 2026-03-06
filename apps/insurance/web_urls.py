from django.urls import path

from .views_web import (
    AppInsuranceDetailView,
    AppInsuranceEditView,
    AppInsuranceNewView,
    AppInsuranceView,
    AppInsuranceDeleteView,
)

urlpatterns = [
    path("", AppInsuranceView.as_view(), name="app_insurance"),
    path("new/", AppInsuranceNewView.as_view(), name="app_insurance_new"),
    path("<uuid:contract_id>/", AppInsuranceDetailView.as_view(), name="app_insurance_detail"),
    path("<uuid:contract_id>/edit/", AppInsuranceEditView.as_view(), name="app_insurance_edit"),
    path("<uuid:contract_id>/delete/", AppInsuranceDeleteView.as_view(), name="app_insurance_delete"),
]
