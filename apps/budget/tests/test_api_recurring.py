# budget/tests/test_api_recurring.py
"""
REST API tests for RecurringExpenseViewSet (/api/budget/recurring/).

Coverage:
  1. TestRecurringList       — list scoping + cross-household isolation
  2. TestRecurringCreate     — happy path, member access, anonymous 401, validation,
                               budget_id attachment + rejection of global/foreign budget
  3. TestRecurringRetrieve   — detail read + cross-household isolation
  4. TestRecurringUpdate     — PATCH fields, budget_id re-resolve, null detach
  5. TestRecurringDelete     — DELETE hard delete, member access, cross-household
  6. TestRecurringDue        — GET /due/ filters by next_due_date <= today
  7. TestRecurringProjection — GET /projection/ shape + 30/90-day horizon math
  8. TestRecurringConfirm    — POST /{id}/confirm/ happy path, amount override,
                               DB state, cross-household isolation
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from budget.models import RecurringExpense
from budget.services import (
    create_budget,
    create_recurring_expense,
)
from households.models import HouseholdMember
from interactions.models import Interaction

from .factories import (
    HouseholdFactory,
    HouseholdMemberFactory,
    RecurringExpenseFactory,
    UserFactory,
)


# ---------------------------------------------------------------------------
# Shared helpers
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


def _create_rec(household, user, **kwargs):
    defaults = dict(
        label="Netflix",
        amount=Decimal("12.99"),
        cadence="monthly",
        next_due_date=date(2026, 8, 1),
    )
    defaults.update(kwargs)
    return create_recurring_expense(household, user, **defaults)


def _rec_payload(**overrides) -> dict:
    payload = {
        "label": "Spotify",
        "amount": "9.99",
        "cadence": "monthly",
        "next_due_date": "2026-08-01",
    }
    payload.update(overrides)
    return payload


# ===========================================================================
# 1. TestRecurringList
# ===========================================================================


@pytest.mark.django_db
class TestRecurringList:
    """GET /api/budget/recurring/ — scoping + cross-household isolation."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def _rec_payload(self, **overrides):
        return _rec_payload(**overrides)

    def test_owner_sees_own_recurrences(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_rec(hh, owner, label="Netflix")
        self._create_rec(hh, owner, label="Spotify")
        response = _client_for(owner).get(reverse("recurring-list"))
        assert response.status_code == status.HTTP_200_OK
        labels = {r["label"] for r in response.data}
        assert "Netflix" in labels
        assert "Spotify" in labels

    def test_cross_household_not_visible(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        self._create_rec(hh_b, owner_b, label="HouseholdB Rent")
        response = _client_for(owner_a).get(reverse("recurring-list"))
        assert response.status_code == status.HTTP_200_OK
        labels = {r["label"] for r in response.data}
        assert "HouseholdB Rent" not in labels

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("recurring-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_can_list(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        response = _client_for(member).get(reverse("recurring-list"))
        assert response.status_code == status.HTTP_200_OK


# ===========================================================================
# 2. TestRecurringCreate
# ===========================================================================


@pytest.mark.django_db
class TestRecurringCreate:
    """POST /api/budget/recurring/ — creates a recurring expense."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def _rec_payload(self, **overrides):
        return _rec_payload(**overrides)

    def test_owner_creates_recurring(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = self._rec_payload(label="Internet", amount="39.99", cadence="monthly")
        response = _client_for(owner).post(reverse("recurring-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["label"] == "Internet"
        assert response.data["amount"] == "39.99"
        # DB state
        rec = RecurringExpense.objects.get(id=response.data["id"])
        assert rec.household == hh
        assert rec.label == "Internet"
        assert rec.amount == Decimal("39.99")

    def test_member_can_create(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        response = _client_for(member).post(
            reverse("recurring-list"), self._rec_payload(label="Member Bill"), format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert RecurringExpense.objects.get(id=response.data["id"]).household == hh

    def test_anonymous_gets_401(self):
        response = _anon_client().post(
            reverse("recurring-list"), self._rec_payload(), format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_creates_with_budget_id(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = create_budget(hh, owner, name="Housing", monthly_amount=Decimal("1000"))
        payload = self._rec_payload(budget_id=str(budget.id))
        response = _client_for(owner).post(reverse("recurring-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        rec = RecurringExpense.objects.get(id=response.data["id"])
        assert rec.budget_id == budget.id

    def test_budget_read_field_returned(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = create_budget(hh, owner, name="Housing", monthly_amount=Decimal("1000"))
        payload = self._rec_payload(budget_id=str(budget.id))
        response = _client_for(owner).post(reverse("recurring-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["budget"]["id"] == str(budget.id)
        assert response.data["budget"]["name"] == "Housing"

    def test_global_budget_id_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        global_b = create_budget(
            hh, owner, name="Global Cap", monthly_amount=Decimal("3000"), is_global=True
        )
        payload = self._rec_payload(budget_id=str(global_b.id))
        response = _client_for(owner).post(reverse("recurring-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "budget_id" in response.data

    def test_foreign_household_budget_id_returns_400(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        budget_b = create_budget(hh_b, owner_b, name="B Budget", monthly_amount=Decimal("500"))
        payload = self._rec_payload(budget_id=str(budget_b.id))
        response = _client_for(owner_a).post(reverse("recurring-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "budget_id" in response.data

    def test_missing_label_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = {k: v for k, v in self._rec_payload().items() if k != "label"}
        response = _client_for(owner).post(reverse("recurring-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "label" in response.data

    def test_blank_label_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(
            reverse("recurring-list"), self._rec_payload(label="   "), format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "label" in response.data

    def test_zero_amount_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(
            reverse("recurring-list"), self._rec_payload(amount="0"), format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "amount" in response.data

    def test_negative_amount_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(
            reverse("recurring-list"), self._rec_payload(amount="-5"), format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "amount" in response.data

    def test_missing_amount_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = {k: v for k, v in self._rec_payload().items() if k != "amount"}
        response = _client_for(owner).post(reverse("recurring-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "amount" in response.data

    def test_missing_next_due_date_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = {k: v for k, v in self._rec_payload().items() if k != "next_due_date"}
        response = _client_for(owner).post(reverse("recurring-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "next_due_date" in response.data


# ===========================================================================
# 3. TestRecurringRetrieve
# ===========================================================================


@pytest.mark.django_db
class TestRecurringRetrieve:
    """GET /api/budget/recurring/{id}/ — detail read + cross-household."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_owner_can_retrieve(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner, label="Insurance")
        response = _client_for(owner).get(reverse("recurring-detail", args=[rec.id]))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(rec.id)
        assert response.data["label"] == "Insurance"

    def test_member_can_retrieve(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        member = _make_member(hh)
        rec = self._create_rec(hh, owner, label="Insurance")
        response = _client_for(member).get(reverse("recurring-detail", args=[rec.id]))
        assert response.status_code == status.HTTP_200_OK

    def test_cross_household_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        rec_a = self._create_rec(hh_a, owner_a, label="Private")
        response = _client_for(owner_b).get(reverse("recurring-detail", args=[rec_a.id]))
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner)
        response = _anon_client().get(reverse("recurring-detail", args=[rec.id]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 4. TestRecurringUpdate
# ===========================================================================


@pytest.mark.django_db
class TestRecurringUpdate:
    """PATCH /api/budget/recurring/{id}/ — partial updates."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_owner_can_patch_label(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner, label="Old")
        response = _client_for(owner).patch(
            reverse("recurring-detail", args=[rec.id]), {"label": "New"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["label"] == "New"
        assert RecurringExpense.objects.get(id=rec.id).label == "New"

    def test_member_can_update(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        member = _make_member(hh)
        rec = self._create_rec(hh, owner, label="Old")
        response = _client_for(member).patch(
            reverse("recurring-detail", args=[rec.id]), {"label": "Updated"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert RecurringExpense.objects.get(id=rec.id).label == "Updated"

    def test_can_attach_budget_via_patch(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = create_budget(hh, owner, name="Housing", monthly_amount=Decimal("1000"))
        rec = self._create_rec(hh, owner)
        response = _client_for(owner).patch(
            reverse("recurring-detail", args=[rec.id]),
            {"budget_id": str(budget.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert RecurringExpense.objects.get(id=rec.id).budget_id == budget.id

    def test_can_detach_budget_via_null(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        budget = create_budget(hh, owner, name="Housing", monthly_amount=Decimal("1000"))
        rec = self._create_rec(hh, owner, budget_id=str(budget.id))
        response = _client_for(owner).patch(
            reverse("recurring-detail", args=[rec.id]),
            {"budget_id": None},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert RecurringExpense.objects.get(id=rec.id).budget_id is None

    def test_cross_household_update_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        rec_a = self._create_rec(hh_a, owner_a, label="Private")
        response = _client_for(owner_b).patch(
            reverse("recurring-detail", args=[rec_a.id]),
            {"label": "Hacked"},
            format="json",
        )
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        assert RecurringExpense.objects.get(id=rec_a.id).label == "Private"

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner)
        response = _anon_client().patch(
            reverse("recurring-detail", args=[rec.id]), {"label": "X"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_blank_label_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner)
        response = _client_for(owner).patch(
            reverse("recurring-detail", args=[rec.id]), {"label": "  "}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "label" in response.data


# ===========================================================================
# 5. TestRecurringDelete
# ===========================================================================


@pytest.mark.django_db
class TestRecurringDelete:
    """DELETE /api/budget/recurring/{id}/ — hard delete, member, cross-household."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_owner_can_delete(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner)
        rec_id = rec.id
        response = _client_for(owner).delete(reverse("recurring-detail", args=[rec_id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not RecurringExpense.objects.filter(id=rec_id).exists()

    def test_member_can_delete(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        member = _make_member(hh)
        rec = self._create_rec(hh, owner)
        rec_id = rec.id
        response = _client_for(member).delete(reverse("recurring-detail", args=[rec_id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not RecurringExpense.objects.filter(id=rec_id).exists()

    def test_cross_household_delete_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        rec_a = self._create_rec(hh_a, owner_a)
        response = _client_for(owner_b).delete(reverse("recurring-detail", args=[rec_a.id]))
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        assert RecurringExpense.objects.filter(id=rec_a.id).exists()

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner)
        response = _anon_client().delete(reverse("recurring-detail", args=[rec.id]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 6. TestRecurringDue
# ===========================================================================


@pytest.mark.django_db
class TestRecurringDue:
    """GET /api/budget/recurring/due/ — only returns recurrences with next_due_date <= today."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_due_today_included(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_rec(hh, owner, label="Due Today", next_due_date=date.today())
        response = _client_for(owner).get(reverse("recurring-due"))
        assert response.status_code == status.HTTP_200_OK
        labels = [r["label"] for r in response.data]
        assert "Due Today" in labels

    def test_past_due_included(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        past = date.today() - timedelta(days=5)
        self._create_rec(hh, owner, label="Overdue", next_due_date=past)
        response = _client_for(owner).get(reverse("recurring-due"))
        assert response.status_code == status.HTTP_200_OK
        labels = [r["label"] for r in response.data]
        assert "Overdue" in labels

    def test_future_due_excluded(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        future = date.today() + timedelta(days=10)
        self._create_rec(hh, owner, label="Future Bill", next_due_date=future)
        response = _client_for(owner).get(reverse("recurring-due"))
        assert response.status_code == status.HTTP_200_OK
        labels = [r["label"] for r in response.data]
        assert "Future Bill" not in labels

    def test_cross_household_not_in_due_list(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        self._create_rec(hh_b, owner_b, label="B Due", next_due_date=date.today())
        response = _client_for(owner_a).get(reverse("recurring-due"))
        assert response.status_code == status.HTTP_200_OK
        labels = [r["label"] for r in response.data]
        assert "B Due" not in labels

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("recurring-due"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 7. TestRecurringProjection
# ===========================================================================


@pytest.mark.django_db
class TestRecurringProjection:
    """GET /api/budget/recurring/projection/ — shape and 30/90-day horizon math."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_projection_shape(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).get(reverse("recurring-projection"))
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert "today" in data
        assert "horizons" in data
        assert isinstance(data["horizons"], list)
        for h in data["horizons"]:
            assert "days" in h
            assert "total" in h
            assert "count" in h

    def test_monthly_recurrence_counts_once_in_30_days(self):
        """A monthly bill due tomorrow appears exactly once in 30-day horizon."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        tomorrow = date.today() + timedelta(days=1)
        self._create_rec(
            hh, owner, label="Monthly Bill", amount=Decimal("50.00"),
            cadence="monthly", next_due_date=tomorrow,
        )
        response = _client_for(owner).get(reverse("recurring-projection"))
        assert response.status_code == status.HTTP_200_OK
        horizons = {h["days"]: h for h in response.data["horizons"]}
        # 30-day window: 1 occurrence
        assert horizons[30]["count"] == 1
        assert Decimal(horizons[30]["total"]) == Decimal("50.00")

    def test_monthly_recurrence_counts_three_times_in_90_days(self):
        """A monthly bill due tomorrow appears ~3× in 90-day horizon."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        tomorrow = date.today() + timedelta(days=1)
        self._create_rec(
            hh, owner, label="Monthly Bill", amount=Decimal("100.00"),
            cadence="monthly", next_due_date=tomorrow,
        )
        response = _client_for(owner).get(reverse("recurring-projection"))
        horizons = {h["days"]: h for h in response.data["horizons"]}
        # 90-day window: 3 monthly occurrences
        assert horizons[90]["count"] == 3
        assert Decimal(horizons[90]["total"]) == Decimal("300.00")

    def test_cross_household_not_in_projection(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        tomorrow = date.today() + timedelta(days=1)
        self._create_rec(hh_b, owner_b, label="B Bill", amount=Decimal("999.00"), next_due_date=tomorrow)
        response = _client_for(owner_a).get(reverse("recurring-projection"))
        horizons = {h["days"]: h for h in response.data["horizons"]}
        assert horizons[30]["count"] == 0
        assert Decimal(horizons[30]["total"]) == Decimal("0.00")

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("recurring-projection"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 8. TestRecurringConfirm
# ===========================================================================


@pytest.mark.django_db
class TestRecurringConfirm:
    """POST /api/budget/recurring/{id}/confirm/ — confirm a due occurrence."""

    def _create_rec(self, hh, user, **kwargs):
        return _create_rec(hh, user, **kwargs)

    def test_owner_can_confirm(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner, next_due_date=date.today())
        response = _client_for(owner).post(
            reverse("recurring-confirm", args=[rec.id]), {}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK

    def test_response_shape(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner, next_due_date=date.today())
        response = _client_for(owner).post(
            reverse("recurring-confirm", args=[rec.id]), {}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert "recurring" in response.data
        assert "interaction_id" in response.data

    def test_next_due_date_advances(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        original_due = date(2026, 7, 15)
        rec = self._create_rec(hh, owner, cadence="monthly", next_due_date=original_due)
        response = _client_for(owner).post(
            reverse("recurring-confirm", args=[rec.id]), {}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        # DB state: next_due_date advanced
        assert RecurringExpense.objects.get(id=rec.id).next_due_date == date(2026, 8, 15)
        # Response echoes advanced date
        assert response.data["recurring"]["next_due_date"] == "2026-08-15"

    def test_interaction_created_in_db(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner, next_due_date=date.today())
        response = _client_for(owner).post(
            reverse("recurring-confirm", args=[rec.id]), {}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        interaction_id = response.data["interaction_id"]
        assert Interaction.objects.filter(id=interaction_id).exists()

    def test_interaction_has_correct_amount(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner, amount=Decimal("55.00"), next_due_date=date.today())
        response = _client_for(owner).post(
            reverse("recurring-confirm", args=[rec.id]), {}, format="json"
        )
        interaction = Interaction.objects.get(id=response.data["interaction_id"])
        assert Decimal(interaction.metadata["amount"]) == Decimal("55.00")

    def test_amount_override_in_body(self):
        """Confirming with an edited amount in body overrides the recurring amount."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner, amount=Decimal("50.00"), next_due_date=date.today())
        response = _client_for(owner).post(
            reverse("recurring-confirm", args=[rec.id]),
            {"amount": "72.50"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        interaction = Interaction.objects.get(id=response.data["interaction_id"])
        assert Decimal(interaction.metadata["amount"]) == Decimal("72.50")

    def test_interaction_metadata_kind_recurring(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner, next_due_date=date.today())
        response = _client_for(owner).post(
            reverse("recurring-confirm", args=[rec.id]), {}, format="json"
        )
        interaction = Interaction.objects.get(id=response.data["interaction_id"])
        assert interaction.metadata["kind"] == "recurring"
        assert interaction.metadata["recurring_id"] == str(rec.id)

    def test_member_can_confirm(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        member = _make_member(hh)
        rec = self._create_rec(hh, owner, next_due_date=date.today())
        response = _client_for(member).post(
            reverse("recurring-confirm", args=[rec.id]), {}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK

    def test_cross_household_confirm_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        rec_a = self._create_rec(hh_a, owner_a, next_due_date=date.today())
        original_due = rec_a.next_due_date
        response = _client_for(owner_b).post(
            reverse("recurring-confirm", args=[rec_a.id]), {}, format="json"
        )
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        # next_due_date must NOT have advanced
        assert RecurringExpense.objects.get(id=rec_a.id).next_due_date == original_due

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        rec = self._create_rec(hh, owner, next_due_date=date.today())
        response = _anon_client().post(
            reverse("recurring-confirm", args=[rec.id]), {}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
