"""
Tests for the lot-1 dashboard additions in apps/alerts/:
  - build_alerts_summary / GET /api/alerts/summary/ now returns:
      * low_stock   — StockItems with status ∈ {low_stock, out_of_stock, expired}
      * low_runway_trackers — consumption trackers whose runway ≤ 14 days
  - total includes both new lists.
  - The "no active household" response includes both keys as empty lists.

Covers: happy path, severity logic, sorting, DB-state verification, household
isolation, anonymous 401, and the "no household" early return.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from stock.models import StockCategory, StockItem
from trackers import services as tracker_services
from trackers.models import Tracker
from zones.models import Zone


# ── Module-level helpers ──────────────────────────────────────────────────────

def _create_household(name: str) -> Household:
    return Household.objects.create(name=name)


def _add_membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _root_zone(household: Household) -> Zone:
    return Zone.objects.get(household=household, parent__isnull=True)


def _create_stock_category(household, user) -> StockCategory:
    return StockCategory.objects.get_or_create(
        household=household,
        name="Divers",
        defaults={"created_by": user},
    )[0]


def _create_stock_item(
    household, user, *, name: str, item_status: str, quantity="0", min_quantity=None
) -> StockItem:
    category = _create_stock_category(household, user)
    return StockItem.objects.create(
        household=household,
        category=category,
        name=name,
        status=item_status,
        quantity=quantity,
        min_quantity=min_quantity,
        unit="unit",
        created_by=user,
    )


def _create_consumption_tracker(
    household, user, *, name: str, reserve: str, daily_consumption: str, emoji: str = ""
) -> Tracker:
    """Create a consumption tracker with a deterministic runway.

    One entry dated today with value=daily_consumption gives rate_per_day ≈
    daily_consumption (coverage floored at 1 day).  runway = reserve / rate.
    """
    tracker = tracker_services.create_tracker(
        household, user,
        name=name,
        unit="kg",
        kind="consumption",
        reserve=reserve,
        emoji=emoji or None,
    )
    tracker_services.add_entry(
        household, user, tracker,
        value=daily_consumption,
        occurred_at=timezone.now(),
    )
    tracker.refresh_from_db()
    return tracker


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return UserFactory(email="alerts-lot1-owner@example.com")


@pytest.fixture
def household(db, owner):
    hh = _create_household("Alerts Lot1 House")
    _add_membership(owner, hh)
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def owner_client(owner, household):
    return _client_for(owner)


# ── low_stock aggregation ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAlertsSummaryLowStock:
    """Covers the new 'low_stock' key in build_alerts_summary / GET /api/alerts/summary/."""

    def _url(self):
        return reverse("alerts-summary")

    def test_empty_household_returns_empty_low_stock(self, owner_client, household):
        response = owner_client.get(self._url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["low_stock"] == []

    def test_in_stock_item_excluded(self, owner_client, household, owner):
        _create_stock_item(household, owner, name="Full", item_status=StockItem.Status.IN_STOCK, quantity="10")
        response = owner_client.get(self._url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["low_stock"] == []

    def test_low_stock_item_returned_as_warning(self, owner_client, household, owner):
        _create_stock_item(household, owner, name="Almost empty", item_status=StockItem.Status.LOW_STOCK, quantity="1")
        response = owner_client.get(self._url())
        assert response.status_code == status.HTTP_200_OK
        low_stock = response.data["low_stock"]
        assert len(low_stock) == 1
        item = low_stock[0]
        assert item["title"] == "Almost empty"
        assert item["status"] == "low_stock"
        assert item["severity"] == "warning"
        assert item["entity_url"] == "/app/stock"
        assert isinstance(item["quantity"], str)

    def test_out_of_stock_item_returned_as_critical(self, owner_client, household, owner):
        _create_stock_item(household, owner, name="Empty jar", item_status=StockItem.Status.OUT_OF_STOCK, quantity="0")
        response = owner_client.get(self._url())
        low_stock = response.data["low_stock"]
        assert len(low_stock) == 1
        assert low_stock[0]["severity"] == "critical"

    def test_expired_item_returned_as_critical(self, owner_client, household, owner):
        _create_stock_item(household, owner, name="Old flour", item_status=StockItem.Status.EXPIRED, quantity="0.5")
        response = owner_client.get(self._url())
        low_stock = response.data["low_stock"]
        assert len(low_stock) == 1
        assert low_stock[0]["severity"] == "critical"

    def test_quantity_and_min_quantity_serialized_as_strings(self, owner_client, household, owner):
        _create_stock_item(
            household, owner,
            name="Checked",
            item_status=StockItem.Status.LOW_STOCK,
            quantity="2.500",
            min_quantity="5.000",
        )
        response = owner_client.get(self._url())
        item = response.data["low_stock"][0]
        assert item["quantity"] == "2.500"
        assert item["min_quantity"] == "5.000"

    def test_min_quantity_none_accepted(self, owner_client, household, owner):
        _create_stock_item(
            household, owner,
            name="No min",
            item_status=StockItem.Status.LOW_STOCK,
            min_quantity=None,
        )
        response = owner_client.get(self._url())
        item = response.data["low_stock"][0]
        assert item["min_quantity"] is None

    def test_sorting_criticals_first_then_by_name_case_insensitive(self, owner_client, household, owner):
        # Insert in reverse-expected order so the test fails if ordering is wrong.
        _create_stock_item(household, owner, name="Zucchini (low)", item_status=StockItem.Status.LOW_STOCK)
        _create_stock_item(household, owner, name="apples (out)", item_status=StockItem.Status.OUT_OF_STOCK)
        _create_stock_item(household, owner, name="Beans (expired)", item_status=StockItem.Status.EXPIRED)
        _create_stock_item(household, owner, name="almonds (low)", item_status=StockItem.Status.LOW_STOCK)

        response = owner_client.get(self._url())
        low_stock = response.data["low_stock"]
        assert len(low_stock) == 4

        # Criticals first (apples, Beans), then warnings (almonds, Zucchini) — case-insensitive
        severities = [item["severity"] for item in low_stock]
        assert severities == ["critical", "critical", "warning", "warning"]

        # Among criticals: apples < Beans (case-insensitive)
        critical_names = [item["title"] for item in low_stock if item["severity"] == "critical"]
        assert critical_names == ["apples (out)", "Beans (expired)"]

        # Among warnings: almonds < Zucchini (case-insensitive)
        warning_names = [item["title"] for item in low_stock if item["severity"] == "warning"]
        assert warning_names == ["almonds (low)", "Zucchini (low)"]

    def test_low_stock_included_in_total(self, owner_client, household, owner):
        _create_stock_item(household, owner, name="A", item_status=StockItem.Status.LOW_STOCK)
        _create_stock_item(household, owner, name="B", item_status=StockItem.Status.OUT_OF_STOCK)
        response = owner_client.get(self._url())
        data = response.data
        # total must be the sum of all lists including low_stock
        assert data["total"] == (
            len(data["overdue_tasks"])
            + len(data["expiring_warranties"])
            + len(data["due_maintenances"])
            + len(data["low_stock"])
            + len(data["low_runway_trackers"])
        )
        assert data["total"] >= 2

    def test_low_stock_household_isolation(self, owner_client, household, owner):
        # Stock items belonging to another household must NOT appear.
        other_owner = UserFactory(email="alerts-lot1-other@example.com")
        other_hh = _create_household("Other Lot1 House")
        _add_membership(other_owner, other_hh)
        _create_stock_item(other_hh, other_owner, name="Foreign empty", item_status=StockItem.Status.OUT_OF_STOCK)

        response = owner_client.get(self._url())
        assert response.data["low_stock"] == []

    def test_item_has_id_field(self, owner_client, household, owner):
        item = _create_stock_item(household, owner, name="With ID", item_status=StockItem.Status.LOW_STOCK)
        response = owner_client.get(self._url())
        assert response.data["low_stock"][0]["id"] == str(item.id)


# ── low_runway_trackers aggregation ──────────────────────────────────────────

@pytest.mark.django_db
class TestAlertsSummaryLowRunwayTrackers:
    """Covers the new 'low_runway_trackers' key in build_alerts_summary."""

    def _url(self):
        return reverse("alerts-summary")

    def test_empty_household_returns_empty_low_runway_trackers(self, owner_client, household):
        response = owner_client.get(self._url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["low_runway_trackers"] == []

    def test_tracker_above_threshold_excluded(self, owner_client, household, owner):
        # reserve=300, consumption=3/day → runway ≈ 100 days (> 14 → absent)
        _create_consumption_tracker(household, owner, name="Long runway", reserve="300", daily_consumption="3")
        response = owner_client.get(self._url())
        assert response.data["low_runway_trackers"] == []

    def test_warning_tracker_returned_at_10_days(self, owner_client, household, owner):
        # reserve=30, consumption=3/day → runway ≈ 10 days (≤ 14, > 7 → warning)
        tracker = _create_consumption_tracker(
            household, owner, name="Warning tracker", reserve="30", daily_consumption="3"
        )
        response = owner_client.get(self._url())
        low_runway = response.data["low_runway_trackers"]
        assert len(low_runway) == 1
        item = low_runway[0]
        assert item["id"] == str(tracker.id)
        assert item["severity"] == "warning"
        assert item["entity_url"] == f"/app/trackers/{tracker.id}"
        assert "runway_days" in item
        assert "runway_until" in item

    def test_critical_tracker_returned_at_2_days(self, owner_client, household, owner):
        # reserve=6, consumption=3/day → runway ≈ 2 days (≤ 7 → critical)
        _create_consumption_tracker(
            household, owner, name="Critical tracker", reserve="6", daily_consumption="3"
        )
        response = owner_client.get(self._url())
        low_runway = response.data["low_runway_trackers"]
        assert len(low_runway) == 1
        assert low_runway[0]["severity"] == "critical"

    def test_measure_tracker_excluded(self, owner_client, household, owner):
        # kind=measure should never appear, regardless of reserve
        tracker_services.create_tracker(
            household, owner,
            name="Measure only",
            unit="kg",
            kind="measure",
        )
        response = owner_client.get(self._url())
        assert response.data["low_runway_trackers"] == []

    def test_inactive_tracker_excluded(self, owner_client, household, owner):
        # reserve=6, consumption=3 → would be critical, but is_active=False → excluded
        tracker = tracker_services.create_tracker(
            household, owner,
            name="Inactive",
            unit="kg",
            kind="consumption",
            reserve="6",
        )
        tracker_services.add_entry(household, owner, tracker, value="3")
        tracker.is_active = False
        tracker.save(update_fields=["is_active"])

        response = owner_client.get(self._url())
        assert response.data["low_runway_trackers"] == []

    def test_tracker_without_reserve_excluded(self, owner_client, household, owner):
        # No reserve → runway() returns None → excluded
        tracker = tracker_services.create_tracker(
            household, owner,
            name="No reserve",
            unit="kg",
            kind="consumption",
        )
        tracker_services.add_entry(household, owner, tracker, value="3")
        response = owner_client.get(self._url())
        assert response.data["low_runway_trackers"] == []

    def test_title_includes_emoji_when_set(self, owner_client, household, owner):
        _create_consumption_tracker(
            household, owner,
            name="Poules",
            reserve="6",
            daily_consumption="3",
            emoji="🐔",
        )
        response = owner_client.get(self._url())
        item = response.data["low_runway_trackers"][0]
        assert item["title"] == "🐔 Poules"

    def test_title_without_emoji_is_name_only(self, owner_client, household, owner):
        _create_consumption_tracker(
            household, owner,
            name="Grain",
            reserve="6",
            daily_consumption="3",
            emoji="",
        )
        response = owner_client.get(self._url())
        item = response.data["low_runway_trackers"][0]
        assert item["title"] == "Grain"

    def test_sorting_by_runway_days_ascending(self, owner_client, household, owner):
        # critical (~2 days) should appear before warning (~10 days)
        _create_consumption_tracker(
            household, owner, name="Long warning", reserve="30", daily_consumption="3"
        )
        _create_consumption_tracker(
            household, owner, name="Short critical", reserve="6", daily_consumption="3"
        )
        response = owner_client.get(self._url())
        low_runway = response.data["low_runway_trackers"]
        assert len(low_runway) == 2
        runway_days = [float(item["runway_days"]) for item in low_runway]
        assert runway_days == sorted(runway_days)
        assert low_runway[0]["title"] == "Short critical"
        assert low_runway[1]["title"] == "Long warning"

    def test_runway_days_and_runway_until_types(self, owner_client, household, owner):
        _create_consumption_tracker(
            household, owner, name="Type check", reserve="6", daily_consumption="3"
        )
        response = owner_client.get(self._url())
        item = response.data["low_runway_trackers"][0]
        # runway_days is a string representation of a Decimal
        assert isinstance(item["runway_days"], str)
        # runway_until is an ISO date string (YYYY-MM-DD)
        from datetime import date
        date.fromisoformat(item["runway_until"])  # raises ValueError if wrong format

    def test_low_runway_trackers_included_in_total(self, owner_client, household, owner):
        _create_consumption_tracker(
            household, owner, name="In total", reserve="6", daily_consumption="3"
        )
        response = owner_client.get(self._url())
        data = response.data
        assert data["total"] == (
            len(data["overdue_tasks"])
            + len(data["expiring_warranties"])
            + len(data["due_maintenances"])
            + len(data["low_stock"])
            + len(data["low_runway_trackers"])
        )
        assert data["total"] >= 1

    def test_low_runway_trackers_household_isolation(self, owner_client, household, owner):
        other_owner = UserFactory(email="alerts-lot1-tracker-other@example.com")
        other_hh = _create_household("Other Tracker House")
        _add_membership(other_owner, other_hh)
        _create_consumption_tracker(
            other_hh, other_owner, name="Foreign critical", reserve="6", daily_consumption="3"
        )
        response = owner_client.get(self._url())
        assert response.data["low_runway_trackers"] == []


# ── Response shape (both keys present) ───────────────────────────────────────

@pytest.mark.django_db
class TestAlertsSummaryResponseShape:
    """Ensures both new keys are always present in the API response."""

    def _url(self):
        return reverse("alerts-summary")

    def test_both_new_keys_present_on_empty_household(self, owner_client, household):
        response = owner_client.get(self._url())
        assert response.status_code == status.HTTP_200_OK
        assert "low_stock" in response.data
        assert "low_runway_trackers" in response.data

    def test_no_active_household_returns_empty_new_keys(self, db):
        """User with no active household → the early-return branch must include both keys."""
        user = UserFactory(email="alerts-lot1-nohouse@example.com")
        # No household attached → request.household is None
        client = _client_for(user)
        response = client.get(self._url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["low_stock"] == []
        assert response.data["low_runway_trackers"] == []
        assert response.data["total"] == 0

    def test_anonymous_request_rejected(self, household):
        client = APIClient()
        response = client.get(self._url())
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
