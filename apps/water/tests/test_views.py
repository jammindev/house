# water/tests/test_views.py
"""API view tests for the water app.

Covers WaterReadingViewSet and WaterConsumptionSummaryView:
  1. Happy-path CRUD with DB-state verification
  2. Ordering (newest first)
  3. Household scoping — household B cannot see/modify household A readings
  4. Unauthenticated → 401
  5. Validation errors (missing fields, bad types, constraint violations)
  6. Summary endpoint: happy-path day/month/year + validation errors

Auth pattern: force_authenticate + user.active_household set (required by
ActiveHouseholdMiddleware to resolve request.household).
"""
from datetime import date
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from households.models import HouseholdMember
from water.models import WaterReading

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory, WaterReadingFactory


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_owner(household):
    """Create a user who is an owner of household, with active_household set."""
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _make_member(household):
    """Create a read-only member of household, with active_household set."""
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


# ---------------------------------------------------------------------------
# TestWaterReadingList
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWaterReadingList:
    """GET /api/water/readings/ — listing, ordering, household isolation."""

    LIST_URL = staticmethod(lambda: reverse("water-reading-list"))

    def _create_reading(self, household, **kwargs):
        owner = kwargs.pop("created_by", UserFactory())
        return WaterReadingFactory(household=household, created_by=owner, **kwargs)

    def test_owner_can_list_own_readings(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_reading(hh, reading_date=date(2024, 1, 10), index_m3=Decimal("100.000"), created_by=owner)
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_member_can_list_readings(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        self._create_reading(hh, reading_date=date(2024, 1, 10), index_m3=Decimal("100.000"))
        client = _client_for(member)
        response = client.get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_ordered_newest_first(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_reading(hh, reading_date=date(2024, 1, 1), index_m3=Decimal("100.000"), created_by=owner)
        self._create_reading(hh, reading_date=date(2024, 6, 1), index_m3=Decimal("200.000"), created_by=owner)
        self._create_reading(hh, reading_date=date(2024, 3, 1), index_m3=Decimal("150.000"), created_by=owner)
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        dates = [r["reading_date"] for r in response.data]
        assert dates == sorted(dates, reverse=True)

    def test_cross_household_readings_not_visible(self):
        """A member of hh_b must not see hh_a's readings."""
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        member_b = _make_member(hh_b)
        reading_a = self._create_reading(
            hh_a, reading_date=date(2024, 5, 1), index_m3=Decimal("100.000"), created_by=owner_a
        )
        client = _client_for(member_b)
        response = client.get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert str(reading_a.id) not in ids


# ---------------------------------------------------------------------------
# TestWaterReadingCreate
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWaterReadingCreate:
    """POST /api/water/readings/ — create, validation, permissions."""

    LIST_URL = staticmethod(lambda: reverse("water-reading-list"))

    def _reading_payload(self, **overrides):
        payload = {"reading_date": "2024-05-15", "index_m3": "123.456"}
        payload.update(overrides)
        return payload

    def test_owner_create_returns_201_and_persists(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        payload = self._reading_payload()
        response = client.post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        # DB state verification
        reading = WaterReading.objects.get(id=response.data["id"])
        assert reading.household == hh
        assert reading.reading_date == date(2024, 5, 15)
        assert reading.index_m3 == Decimal("123.456")

    def test_member_create_returns_201(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        client = _client_for(member)
        response = client.post(self.LIST_URL(), self._reading_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_anonymous_create_returns_401(self):
        response = _anon_client().post(self.LIST_URL(), self._reading_payload(), format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_reading_date_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        payload = {"index_m3": "100.000"}
        response = client.post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "reading_date" in response.data

    def test_missing_index_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        payload = {"reading_date": "2024-05-15"}
        response = client.post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "index_m3" in response.data

    def test_negative_index_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(self.LIST_URL(), self._reading_payload(index_m3="-5.000"), format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "index_m3" in response.data

    def test_duplicate_date_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 5, 15), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._reading_payload(index_m3="110.000"),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "reading_date" in response.data

    def test_index_lower_than_previous_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 5, 1), index_m3=Decimal("200.000"),
            created_by=owner,
        )
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._reading_payload(reading_date="2024-05-15", index_m3="100.000"),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "index_m3" in response.data


# ---------------------------------------------------------------------------
# TestWaterReadingRetrieve
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWaterReadingRetrieve:
    """GET /api/water/readings/<id>/ — retrieve, cross-household isolation."""

    DETAIL_URL = staticmethod(lambda pk: reverse("water-reading-detail", args=[pk]))

    def _create_reading(self, household, **kwargs):
        return WaterReadingFactory(household=household, **kwargs)

    def test_owner_retrieve_returns_200(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        reading = self._create_reading(
            hh, reading_date=date(2024, 4, 1), index_m3=Decimal("100.000"), created_by=owner
        )
        client = _client_for(owner)
        response = client.get(self.DETAIL_URL(reading.id))
        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["id"]) == str(reading.id)
        assert Decimal(response.data["index_m3"]) == Decimal("100.000")

    def test_anonymous_retrieve_returns_401(self):
        hh = HouseholdFactory()
        reading = self._create_reading(
            hh, reading_date=date(2024, 4, 1), index_m3=Decimal("100.000")
        )
        response = _anon_client().get(self.DETAIL_URL(reading.id))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_retrieve_returns_404(self):
        """A user from hh_b cannot retrieve hh_a's reading."""
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        member_b = _make_member(hh_b)
        reading_a = self._create_reading(
            hh_a, reading_date=date(2024, 4, 1), index_m3=Decimal("100.000"), created_by=owner_a
        )
        client = _client_for(member_b)
        response = client.get(self.DETAIL_URL(reading_a.id))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# TestWaterReadingUpdate
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWaterReadingUpdate:
    """PATCH /api/water/readings/<id>/ — update, validation, permissions."""

    DETAIL_URL = staticmethod(lambda pk: reverse("water-reading-detail", args=[pk]))

    def _create_reading(self, household, **kwargs):
        return WaterReadingFactory(household=household, **kwargs)

    def test_owner_patch_index_persists(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        reading = self._create_reading(
            hh, reading_date=date(2024, 5, 10), index_m3=Decimal("100.000"), created_by=owner
        )
        client = _client_for(owner)
        response = client.patch(
            self.DETAIL_URL(reading.id),
            {"index_m3": "105.000"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        reading.refresh_from_db()
        assert reading.index_m3 == Decimal("105.000")

    def test_member_patch_allowed(self):
        hh = HouseholdFactory()
        _make_owner(hh)
        member = _make_member(hh)
        reading = self._create_reading(
            hh, reading_date=date(2024, 5, 10), index_m3=Decimal("100.000")
        )
        client = _client_for(member)
        response = client.patch(
            self.DETAIL_URL(reading.id),
            {"index_m3": "102.000"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

    def test_anonymous_patch_returns_401(self):
        hh = HouseholdFactory()
        reading = self._create_reading(
            hh, reading_date=date(2024, 5, 10), index_m3=Decimal("100.000")
        )
        response = _anon_client().patch(
            self.DETAIL_URL(reading.id), {"index_m3": "102.000"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_patch_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        member_b = _make_member(hh_b)
        reading_a = self._create_reading(
            hh_a, reading_date=date(2024, 5, 10), index_m3=Decimal("100.000"), created_by=owner_a
        )
        client = _client_for(member_b)
        response = client.patch(
            self.DETAIL_URL(reading_a.id), {"index_m3": "110.000"}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_patch_violating_monotonicity_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_reading(
            hh, reading_date=date(2024, 5, 1), index_m3=Decimal("200.000"), created_by=owner
        )
        reading = self._create_reading(
            hh, reading_date=date(2024, 5, 20), index_m3=Decimal("210.000"), created_by=owner
        )
        client = _client_for(owner)
        response = client.patch(
            self.DETAIL_URL(reading.id), {"index_m3": "150.000"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "index_m3" in response.data


# ---------------------------------------------------------------------------
# TestWaterReadingDelete
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWaterReadingDelete:
    """DELETE /api/water/readings/<id>/ — delete, permissions."""

    DETAIL_URL = staticmethod(lambda pk: reverse("water-reading-detail", args=[pk]))

    def _create_reading(self, household, **kwargs):
        return WaterReadingFactory(household=household, **kwargs)

    def test_owner_delete_returns_204_and_removes_from_db(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        reading = self._create_reading(
            hh, reading_date=date(2024, 7, 1), index_m3=Decimal("100.000"), created_by=owner
        )
        client = _client_for(owner)
        response = client.delete(self.DETAIL_URL(reading.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not WaterReading.objects.filter(id=reading.id).exists()

    def test_anonymous_delete_returns_401(self):
        hh = HouseholdFactory()
        reading = self._create_reading(
            hh, reading_date=date(2024, 7, 1), index_m3=Decimal("100.000")
        )
        response = _anon_client().delete(self.DETAIL_URL(reading.id))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_delete_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        member_b = _make_member(hh_b)
        reading_a = self._create_reading(
            hh_a, reading_date=date(2024, 7, 1), index_m3=Decimal("100.000"), created_by=owner_a
        )
        client = _client_for(member_b)
        response = client.delete(self.DETAIL_URL(reading_a.id))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        # Reading still exists in DB
        assert WaterReading.objects.filter(id=reading_a.id).exists()


# ---------------------------------------------------------------------------
# TestWaterConsumptionSummary
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWaterConsumptionSummary:
    """GET /api/water/consumption/summary/ — happy path + validation errors."""

    SUMMARY_URL = staticmethod(lambda: reverse("water-consumption-summary"))

    def _create_reading(self, household, **kwargs):
        return WaterReadingFactory(household=household, **kwargs)

    def test_happy_path_day_granularity(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_reading(
            hh, reading_date=date(2024, 1, 1), index_m3=Decimal("100.000"), created_by=owner
        )
        self._create_reading(
            hh, reading_date=date(2024, 1, 11), index_m3=Decimal("101.000"), created_by=owner
        )
        client = _client_for(owner)
        response = client.get(
            self.SUMMARY_URL(),
            {"granularity": "day", "date_from": "2024-01-01", "date_to": "2024-01-10"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["granularity"] == "day"
        assert "total_l" in response.data
        assert "buckets" in response.data
        # 10 days, delta = 1 m³ = 1000 l total
        assert response.data["total_l"] == 1000

    def test_happy_path_month_granularity(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_reading(
            hh, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"), created_by=owner
        )
        self._create_reading(
            hh, reading_date=date(2024, 4, 1), index_m3=Decimal("3.000"), created_by=owner
        )
        client = _client_for(owner)
        response = client.get(
            self.SUMMARY_URL(),
            {"granularity": "month", "date_from": "2024-01-01", "date_to": "2024-03-31"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["granularity"] == "month"
        # Buckets should be grouped by month
        if response.data["buckets"]:
            for bucket in response.data["buckets"]:
                # Month bucket timestamps start at day=1
                assert bucket["ts"][8:10] == "01"

    def test_happy_path_year_granularity(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_reading(
            hh, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"), created_by=owner
        )
        self._create_reading(
            hh, reading_date=date(2025, 1, 1), index_m3=Decimal("12.000"), created_by=owner
        )
        client = _client_for(owner)
        response = client.get(
            self.SUMMARY_URL(),
            {"granularity": "year", "date_from": "2024-01-01", "date_to": "2024-12-31"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["granularity"] == "year"
        # Year bucket: ts starts at Jan 1
        if response.data["buckets"]:
            for bucket in response.data["buckets"]:
                assert bucket["ts"][5:10] == "01-01"

    def test_empty_result_when_no_readings(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.get(
            self.SUMMARY_URL(),
            {"granularity": "day", "date_from": "2024-01-01", "date_to": "2024-01-31"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_l"] == 0
        assert response.data["buckets"] == []

    def test_anonymous_summary_returns_401(self):
        response = _anon_client().get(
            self.SUMMARY_URL(),
            {"granularity": "day", "date_from": "2024-01-01", "date_to": "2024-01-31"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_bad_granularity_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.get(
            self.SUMMARY_URL(),
            {"granularity": "week", "date_from": "2024-01-01", "date_to": "2024-01-31"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "granularity" in response.data

    def test_missing_date_from_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.get(
            self.SUMMARY_URL(),
            {"granularity": "day", "date_to": "2024-01-31"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_date_to_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.get(
            self.SUMMARY_URL(),
            {"granularity": "day", "date_from": "2024-01-01"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_date_to_before_date_from_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.get(
            self.SUMMARY_URL(),
            {"granularity": "day", "date_from": "2024-06-01", "date_to": "2024-01-01"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "date_to" in response.data

    def test_cross_household_readings_not_included_in_summary(self):
        """Summary only aggregates the authenticated user's household readings."""
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        # hh_b has a big reading that should not contaminate hh_a's summary
        WaterReadingFactory(
            household=hh_b, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"),
            created_by=owner_b,
        )
        WaterReadingFactory(
            household=hh_b, reading_date=date(2024, 2, 1), index_m3=Decimal("999.000"),
            created_by=owner_b,
        )
        # hh_a has no readings
        client = _client_for(owner_a)
        response = client.get(
            self.SUMMARY_URL(),
            {"granularity": "day", "date_from": "2024-01-01", "date_to": "2024-01-31"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_l"] == 0
