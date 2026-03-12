from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.translation import gettext as _
from django.views.generic import View

from .models import InsuranceContract


def _parse_optional_date(value):
    value = (value or "").strip()
    return value or None


def _parse_optional_decimal(value):
    value = (value or "").strip()
    if not value:
        return Decimal("0")
    try:
        parsed = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(_("Invalid amount.")) from exc
    if parsed < 0:
        raise ValueError(_("Amount must be non-negative."))
    return parsed


def _hydrate_contract_from_post(contract, request):
    contract.name = (request.POST.get("name") or "").strip()
    contract.provider = (request.POST.get("provider") or "").strip()
    contract.contract_number = (request.POST.get("contract_number") or "").strip()
    contract.type = (request.POST.get("type") or InsuranceContract.InsuranceType.OTHER).strip()
    contract.insured_item = (request.POST.get("insured_item") or "").strip()
    contract.start_date = _parse_optional_date(request.POST.get("start_date"))
    contract.end_date = _parse_optional_date(request.POST.get("end_date"))
    contract.renewal_date = _parse_optional_date(request.POST.get("renewal_date"))
    contract.status = (request.POST.get("status") or InsuranceContract.InsuranceStatus.ACTIVE).strip()
    contract.payment_frequency = (request.POST.get("payment_frequency") or InsuranceContract.PaymentFrequency.MONTHLY).strip()
    contract.monthly_cost = _parse_optional_decimal(request.POST.get("monthly_cost"))
    contract.yearly_cost = _parse_optional_decimal(request.POST.get("yearly_cost"))
    contract.coverage_summary = (request.POST.get("coverage_summary") or "").strip()
    contract.notes = (request.POST.get("notes") or "").strip()


def _form_choices():
    return {
        "type_choices": InsuranceContract.InsuranceType.choices,
        "status_choices": InsuranceContract.InsuranceStatus.choices,
        "payment_frequency_choices": InsuranceContract.PaymentFrequency.choices,
    }

class AppInsuranceView(LoginRequiredMixin, View):
    def get(self, request):
        selected_household = request.household
        contracts = InsuranceContract.objects.for_user_households(request.user)
        if selected_household:
            contracts = contracts.filter(household=selected_household)
        return render(
            request,
            "insurance/app/insurance.html",
            {
                "contracts": contracts.order_by("renewal_date", "name"),
                "household": selected_household,
            },
        )


class AppInsuranceNewView(LoginRequiredMixin, View):
    def get(self, request, contract=None, selected_household=None):
        if selected_household is None:
            selected_household = request.household
        if selected_household is None:
            messages.error(request, _("No household selected."))
            return redirect("app_dashboard")
        if contract is None:
            contract = InsuranceContract(household=selected_household)
        return render(
            request,
            "insurance/app/insurance_new.html",
            {
                "contract": contract,
                "household": selected_household,
                **_form_choices(),
            },
        )

    def post(self, request):
        selected_household = request.household
        if selected_household is None:
            messages.error(request, _("No household selected."))
            return redirect("app_dashboard")
        contract = InsuranceContract(household=selected_household)
        try:
            _hydrate_contract_from_post(contract, request)
            if not contract.name:
                raise ValueError(_("Name is required."))
            contract.created_by = request.user
            contract.updated_by = request.user
            contract.full_clean()
            contract.save()
            messages.success(request, _("Insurance contract created."))
            return redirect("app_insurance_detail", contract_id=contract.id)
        except ValueError as exc:
            messages.error(request, str(exc))
        return self.get(request, contract=contract, selected_household=selected_household)


class AppInsuranceDetailView(LoginRequiredMixin, View):
    def get(self, request, contract_id):
        contract = get_object_or_404(InsuranceContract.objects.for_user_households(request.user), id=contract_id)
        return render(
            request,
            "insurance/app/insurance_detail.html",
            {"contract": contract},
        )


class AppInsuranceEditView(LoginRequiredMixin, View):
    def get(self, request, contract_id, contract=None):
        if contract is None:
            contract = get_object_or_404(InsuranceContract.objects.for_user_households(request.user), id=contract_id)
        return render(
            request,
            "insurance/app/insurance_edit.html",
            {
                "contract": contract,
                **_form_choices(),
            },
        )

    def post(self, request, contract_id):
        contract = get_object_or_404(InsuranceContract.objects.for_user_households(request.user), id=contract_id)
        try:
            _hydrate_contract_from_post(contract, request)
            if not contract.name:
                raise ValueError(_("Name is required."))
            contract.updated_by = request.user
            contract.full_clean()
            contract.save()
            messages.success(request, _("Insurance contract updated."))
            return redirect("app_insurance_detail", contract_id=contract.id)
        except ValueError as exc:
            messages.error(request, str(exc))
        return self.get(request, contract_id, contract=contract)


class AppInsuranceDeleteView(LoginRequiredMixin, View):
    def post(self, request, contract_id):
        contract = get_object_or_404(InsuranceContract.objects.for_user_households(request.user), id=contract_id)
        contract.delete()
        messages.success(request, _("Insurance contract deleted."))
        return redirect("app_insurance")

    def get(self, request, contract_id):
        return redirect("app_insurance_detail", contract_id=contract_id)
