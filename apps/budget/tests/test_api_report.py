# budget/tests/test_api_report.py
"""
REST API tests for BudgetReportViewSet (/api/budget/reports/).

Coverage:
  1. TestBudgetReportList     — list scoping, cross-household isolation, anon 401
  2. TestBudgetReportLatest   — GET /latest/ creates + returns report, response shape
  3. TestBudgetReportRetrieve — retrieve by month (lookup_field='month'), isolation
  4. TestBudgetReportReadOnly — POST/PUT/DELETE → 405 (read-only viewset)
  5. TestBudgetReportPermissions — authenticated members can read, anon cannot
"""
from __future__ import annotations

from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from budget.models import BudgetReport
from budget.report.service import get_or_generate_report, last_closed_month
from budget.services import create_budget
from households.models import HouseholdMember
from interactions.services import create_manual_expense_interaction

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _make_member(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _anon_client() -> APIClient:
    return APIClient()


def _make_expense(household, user, amount, *, month):
    from datetime import datetime

    tz = ZoneInfo(getattr(household, "timezone", None) or "UTC")
    year, mon = (int(p) for p in month.split("-"))
    occurred_at = datetime(year, mon, 15, tzinfo=tz)
    return create_manual_expense_interaction(
        household=household,
        user=user,
        subject="Test expense",
        amount=Decimal(str(amount)),
        occurred_at=occurred_at,
    )


def _create_report(household, month) -> BudgetReport:
    return get_or_generate_report(household, month)


# ===========================================================================
# 1. TestBudgetReportList
# ===========================================================================


@pytest.mark.django_db
class TestBudgetReportList:
    """GET /api/budget/reports/ — household scoping and cross-household isolation."""

    def test_owner_can_list_own_reports(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _create_report(hh, "2026-04")
        _create_report(hh, "2026-03")
        client = _client_for(owner)
        response = client.get(reverse("budget-report-list"))
        assert response.status_code == status.HTTP_200_OK
        months = [r["month"] for r in response.data]
        assert "2026-04" in months
        assert "2026-03" in months

    def test_cross_household_reports_not_visible(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        _create_report(hh_b, "2026-04")
        client = _client_for(owner_a)
        response = client.get(reverse("budget-report-list"))
        assert response.status_code == status.HTTP_200_OK
        months = [r["month"] for r in response.data]
        assert "2026-04" not in months

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("budget-report-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_can_list(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        _create_report(hh, "2026-04")
        client = _client_for(member)
        response = client.get(reverse("budget-report-list"))
        assert response.status_code == status.HTTP_200_OK

    def test_list_response_contains_required_fields(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _create_report(hh, "2026-04")
        client = _client_for(owner)
        response = client.get(reverse("budget-report-list"))
        assert response.status_code == status.HTTP_200_OK
        if response.data:
            row = response.data[0]
            for field in ("id", "month", "text", "stats", "created_at"):
                assert field in row

    def test_list_ordered_by_month_descending(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _create_report(hh, "2026-03")
        _create_report(hh, "2026-04")
        _create_report(hh, "2026-05")
        client = _client_for(owner)
        response = client.get(reverse("budget-report-list"))
        assert response.status_code == status.HTTP_200_OK
        months = [r["month"] for r in response.data]
        assert months == sorted(months, reverse=True)


# ===========================================================================
# 2. TestBudgetReportLatest
# ===========================================================================


@pytest.mark.django_db
class TestBudgetReportLatest:
    """GET /api/budget/reports/latest/ — ensures + returns last closed month's report."""

    def test_creates_report_if_not_exists(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        month = last_closed_month(hh)
        # No pre-existing report
        assert not BudgetReport.objects.filter(household=hh, month=month).exists()
        client = _client_for(owner)
        response = client.get(reverse("budget-report-latest"))
        assert response.status_code == status.HTTP_200_OK
        assert BudgetReport.objects.filter(household=hh, month=month).exists()

    def test_returns_last_closed_month(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        expected_month = last_closed_month(hh)
        client = _client_for(owner)
        response = client.get(reverse("budget-report-latest"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["month"] == expected_month

    def test_response_has_required_fields(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.get(reverse("budget-report-latest"))
        assert response.status_code == status.HTTP_200_OK
        for field in ("id", "month", "text", "stats", "created_at"):
            assert field in response.data

    def test_text_field_is_string(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.get(reverse("budget-report-latest"))
        assert isinstance(response.data["text"], str)

    def test_idempotent_two_calls_return_same_report_id(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        r1 = client.get(reverse("budget-report-latest"))
        r2 = client.get(reverse("budget-report-latest"))
        assert r1.status_code == status.HTTP_200_OK
        assert r2.status_code == status.HTTP_200_OK
        assert r1.data["id"] == r2.data["id"]

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("budget-report-latest"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_can_access_latest(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        client = _client_for(member)
        response = client.get(reverse("budget-report-latest"))
        assert response.status_code == status.HTTP_200_OK

    def test_stats_polished_key_stripped_from_response(self):
        """The internal _polished cache must not leak to the API consumer."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        month = last_closed_month(hh)
        # Pre-create report and inject a fake _polished cache
        report = get_or_generate_report(hh, month)
        stats = dict(report.stats)
        stats["_polished"] = {"en": "cached polished text"}
        report.stats = stats
        report.save(update_fields=["stats", "updated_at"])

        client = _client_for(owner)
        response = client.get(reverse("budget-report-latest"))
        assert response.status_code == status.HTTP_200_OK
        assert "_polished" not in response.data["stats"]


# ===========================================================================
# 3. TestBudgetReportRetrieve
# ===========================================================================


@pytest.mark.django_db
class TestBudgetReportRetrieve:
    """GET /api/budget/reports/{month}/ — retrieve by month, cross-household isolation."""

    def test_owner_can_retrieve_by_month(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _create_report(hh, "2026-04")
        client = _client_for(owner)
        response = client.get(reverse("budget-report-detail", args=["2026-04"]))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["month"] == "2026-04"

    def test_retrieve_response_has_required_fields(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _create_report(hh, "2026-04")
        client = _client_for(owner)
        response = client.get(reverse("budget-report-detail", args=["2026-04"]))
        assert response.status_code == status.HTTP_200_OK
        for field in ("id", "month", "text", "stats", "created_at"):
            assert field in response.data

    def test_member_can_retrieve(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        _create_report(hh, "2026-04")
        client = _client_for(member)
        response = client.get(reverse("budget-report-detail", args=["2026-04"]))
        assert response.status_code == status.HTTP_200_OK

    def test_cross_household_report_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        _create_report(hh_a, "2026-04")
        client_b = _client_for(owner_b)
        response = client_b.get(reverse("budget-report-detail", args=["2026-04"]))
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_nonexistent_month_returns_404(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.get(reverse("budget-report-detail", args=["2020-01"]))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        _create_report(hh, "2026-04")
        response = _anon_client().get(reverse("budget-report-detail", args=["2026-04"]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 4. TestBudgetReportReadOnly
# ===========================================================================


@pytest.mark.django_db
class TestBudgetReportReadOnly:
    """BudgetReportViewSet is read-only — POST / PUT / DELETE must return 405."""

    def test_post_returns_405(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(
            reverse("budget-report-list"),
            {"month": "2026-04", "stats": {}},
            format="json",
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_put_returns_405(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _create_report(hh, "2026-04")
        client = _client_for(owner)
        response = client.put(
            reverse("budget-report-detail", args=["2026-04"]),
            {"month": "2026-04"},
            format="json",
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_delete_returns_405(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _create_report(hh, "2026-04")
        client = _client_for(owner)
        response = client.delete(reverse("budget-report-detail", args=["2026-04"]))
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_patch_returns_405(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _create_report(hh, "2026-04")
        client = _client_for(owner)
        response = client.patch(
            reverse("budget-report-detail", args=["2026-04"]),
            {"month": "2026-04"},
            format="json",
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
