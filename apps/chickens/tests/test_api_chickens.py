# chickens/tests/test_api_chickens.py
"""
REST API tests for the chickens module — ChickenViewSet, EggLogViewSet,
ChickenEventViewSet, ChickenSettingsView, ChickenSummaryView.

Coverage per US:
  1. ChickenViewSet CRUD — create/list/retrieve/patch/delete + household scoping
  2. Status→event auto-creation (deceased/gone → death/departure journal entry)
  3. EggLog upsert semantics — 201/200, uniqueness, negative count
  4. EggLog stats endpoint
  5. ChickenEvent CRUD + care-reminder Task creation + cross-household chicken FK
  6. POST /purchase/ — creates an Interaction of kind chickens_purchase
  7. ChickenSettingsView — GET get-or-create, PUT validation
  8. ChickenSummaryView — shape + numeric correctness
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from chickens.models import Chicken, ChickenEvent, ChickenSettings, EggLog
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from stock.models import StockCategory, StockItem
from tasks.models import Task
from zones.models import Zone

from .factories import (
    ChickenEventFactory,
    ChickenFactory,
    EggLogFactory,
    HouseholdFactory,
    HouseholdMemberFactory,
    UserFactory,
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_owner(household):
    """Create a user that is owner of *household*, with active_household set."""
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _make_member(household):
    """Create a regular member of *household*, with active_household set."""
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


def _create_zone(household, user, name="Poulailler Zone"):
    return Zone.objects.create(household=household, name=name, created_by=user)


def _create_stock_item(household, user, name="Feed bag", quantity="20.000"):
    category = StockCategory.objects.create(
        household=household, name=f"Food — {name}", created_by=user
    )
    return StockItem.objects.create(
        household=household,
        created_by=user,
        category=category,
        name=name,
        quantity=Decimal(quantity),
        unit="kg",
        min_quantity=Decimal("5.000"),
    )


# ===========================================================================
# 1. ChickenViewSet — CRUD
# ===========================================================================


@pytest.mark.django_db
class TestChickenCreate:
    """POST /api/chickens/ — creates a hen, validates required fields."""

    def _chicken_payload(self, **overrides):
        payload = {"name": "Cocotte"}
        payload.update(overrides)
        return payload

    def test_owner_creates_chicken(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(reverse("chicken-list"), self._chicken_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Cocotte"
        chicken = Chicken.objects.get(id=response.data["id"])
        assert chicken.household == hh
        assert chicken.created_by == owner

    def test_member_can_create_chicken(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        client = _client_for(member)
        response = client.post(reverse("chicken-list"), self._chicken_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_anonymous_gets_401(self):
        response = _anon_client().post(reverse("chicken-list"), self._chicken_payload(), format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_name_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(reverse("chicken-list"), {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data

    def test_blank_name_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(reverse("chicken-list"), {"name": "   "}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data

    def test_optional_fields_saved(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        payload = self._chicken_payload(
            breed="Leghorn",
            color="white",
            hatched_on="2023-03-15",
            acquired_on="2023-06-01",
            notes="Very calm.",
        )
        response = client.post(reverse("chicken-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        chicken = Chicken.objects.get(id=response.data["id"])
        assert chicken.breed == "Leghorn"
        assert chicken.color == "white"
        assert chicken.hatched_on == date(2023, 3, 15)
        assert chicken.notes == "Very calm."

    def test_zone_id_valid_household_accepted(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = _create_zone(hh, owner)
        client = _client_for(owner)
        response = client.post(
            reverse("chicken-list"),
            self._chicken_payload(zone_id=str(zone.id)),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        chicken = Chicken.objects.get(id=response.data["id"])
        assert chicken.zone == zone

    def test_zone_id_from_other_household_returns_400(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_owner = _make_owner(other_hh)
        other_zone = _create_zone(other_hh, other_owner)
        client = _client_for(owner)
        response = client.post(
            reverse("chicken-list"),
            self._chicken_payload(zone_id=str(other_zone.id)),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestChickenList:
    """GET /api/chickens/ — listing, household scoping, filters."""

    def test_owner_sees_own_chickens(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        ChickenFactory(household=hh, created_by=owner)
        ChickenFactory(household=hh, created_by=owner)
        response = _client_for(owner).get(reverse("chicken-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_does_not_see_other_household_chickens(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        ChickenFactory(household=hh_b, created_by=owner_b)
        response = _client_for(owner_a).get(reverse("chicken-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("chicken-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_filter_by_status(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.ACTIVE)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.DECEASED)
        url = reverse("chicken-list") + "?status=active"
        response = _client_for(owner).get(url)
        assert response.status_code == status.HTTP_200_OK
        assert all(c["status"] == "active" for c in response.data)

    def test_in_flock_filter_excludes_deceased_and_gone(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.ACTIVE)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.BROODY)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.DECEASED)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.GONE)
        url = reverse("chicken-list") + "?in_flock=true"
        response = _client_for(owner).get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        assert all(c["status"] in ("active", "broody") for c in response.data)


@pytest.mark.django_db
class TestChickenRetrieveUpdateDelete:
    """GET/PATCH/DELETE /api/chickens/{id}/."""

    def test_owner_can_retrieve(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner, name="Bella")
        response = _client_for(owner).get(reverse("chicken-detail", args=[chicken.id]))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Bella"

    def test_cross_household_retrieve_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        chicken_b = ChickenFactory(household=hh_b, created_by=owner_b)
        response = _client_for(owner_a).get(reverse("chicken-detail", args=[chicken_b.id]))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_owner_can_patch(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner, name="Bella")
        response = _client_for(owner).patch(
            reverse("chicken-detail", args=[chicken.id]),
            {"name": "Bella Updated"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Bella Updated"
        chicken.refresh_from_db()
        assert chicken.name == "Bella Updated"

    def test_cross_household_patch_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        chicken_b = ChickenFactory(household=hh_b, created_by=owner_b, name="Bella B")
        response = _client_for(owner_a).patch(
            reverse("chicken-detail", args=[chicken_b.id]),
            {"name": "Stolen"},
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        chicken_b.refresh_from_db()
        assert chicken_b.name == "Bella B"

    def test_owner_can_delete(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner)
        response = _client_for(owner).delete(reverse("chicken-detail", args=[chicken.id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Chicken.objects.filter(id=chicken.id).exists()

    def test_anonymous_retrieve_returns_401(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner)
        response = _anon_client().get(reverse("chicken-detail", args=[chicken.id]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 2. Status→event auto-creation (US-2)
# ===========================================================================


@pytest.mark.django_db
class TestChickenStatusAutoEvent:
    """PATCH status=deceased/gone auto-creates a matching ChickenEvent."""

    def test_patch_to_deceased_creates_death_event(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.ACTIVE)
        _client_for(owner).patch(
            reverse("chicken-detail", args=[chicken.id]),
            {"status": "deceased"},
            format="json",
        )
        events = ChickenEvent.objects.filter(chicken=chicken, type=ChickenEvent.Type.DEATH)
        assert events.count() == 1
        assert events.first().occurred_on == timezone.localdate()

    def test_patch_to_gone_creates_departure_event(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.ACTIVE)
        _client_for(owner).patch(
            reverse("chicken-detail", args=[chicken.id]),
            {"status": "gone"},
            format="json",
        )
        events = ChickenEvent.objects.filter(chicken=chicken, type=ChickenEvent.Type.DEPARTURE)
        assert events.count() == 1
        assert events.first().occurred_on == timezone.localdate()

    def test_patch_to_active_does_not_create_event(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.SICK)
        before = ChickenEvent.objects.filter(chicken=chicken).count()
        _client_for(owner).patch(
            reverse("chicken-detail", args=[chicken.id]),
            {"status": "active"},
            format="json",
        )
        assert ChickenEvent.objects.filter(chicken=chicken).count() == before

    def test_patch_deceased_already_deceased_no_duplicate_event(self):
        """Re-patching to the same terminal status must not create a second event."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.DECEASED)
        _client_for(owner).patch(
            reverse("chicken-detail", args=[chicken.id]),
            {"status": "deceased"},
            format="json",
        )
        events = ChickenEvent.objects.filter(chicken=chicken, type=ChickenEvent.Type.DEATH)
        assert events.count() == 0  # no transition, so no auto-event

    def test_deceased_chicken_not_in_summary_active_count(self):
        """active_count in summary must exclude deceased/gone hens."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.ACTIVE)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.DECEASED)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.GONE)
        response = _client_for(owner).get(reverse("chicken-summary"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["active_count"] == 1


# ===========================================================================
# 3. EggLog upsert semantics (US-3)
# ===========================================================================


@pytest.mark.django_db
class TestEggLogCreate:
    """POST /api/chickens/egg-logs/ — upsert on (household, date)."""

    def _egg_payload(self, **overrides):
        payload = {"date": "2024-06-15", "count": 4}
        payload.update(overrides)
        return payload

    def test_first_post_creates_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(
            reverse("chicken-egg-log-list"), self._egg_payload(), format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert EggLog.objects.filter(household=hh, date=date(2024, 6, 15)).count() == 1

    def test_second_post_same_day_upserts_200(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        client.post(reverse("chicken-egg-log-list"), self._egg_payload(count=4), format="json")
        response = client.post(reverse("chicken-egg-log-list"), self._egg_payload(count=7), format="json")
        assert response.status_code == status.HTTP_200_OK
        assert EggLog.objects.filter(household=hh, date=date(2024, 6, 15)).count() == 1
        log = EggLog.objects.get(household=hh, date=date(2024, 6, 15))
        assert log.count == 7

    def test_upsert_replaces_count_not_adds(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        client.post(reverse("chicken-egg-log-list"), self._egg_payload(count=4), format="json")
        client.post(reverse("chicken-egg-log-list"), self._egg_payload(count=3), format="json")
        log = EggLog.objects.get(household=hh, date=date(2024, 6, 15))
        assert log.count == 3  # replaced, not 4+3=7

    def test_negative_count_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        # PositiveIntegerField in DRF rejects negative values
        response = _client_for(owner).post(
            reverse("chicken-egg-log-list"), self._egg_payload(count=-1), format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "count" in response.data

    def test_anonymous_gets_401(self):
        response = _anon_client().post(
            reverse("chicken-egg-log-list"), self._egg_payload(), format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_isolation_in_list(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        EggLogFactory(household=hh_b, created_by=owner_b, date=date(2024, 6, 15), count=5)
        response = _client_for(owner_a).get(reverse("chicken-egg-log-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0

    def test_egg_log_delete(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        log = EggLogFactory(household=hh, created_by=owner, date=date(2024, 6, 15), count=4)
        response = _client_for(owner).delete(reverse("chicken-egg-log-detail", args=[log.id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not EggLog.objects.filter(id=log.id).exists()

    def test_cross_household_delete_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        log_b = EggLogFactory(household=hh_b, created_by=owner_b, date=date(2024, 6, 15), count=4)
        response = _client_for(owner_a).delete(reverse("chicken-egg-log-detail", args=[log_b.id]))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert EggLog.objects.filter(id=log_b.id).exists()


@pytest.mark.django_db
class TestEggLogDateFilters:
    """GET /api/chickens/egg-logs/?date_from=&date_to="""

    def test_date_from_excludes_earlier_logs(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        EggLogFactory(household=hh, created_by=owner, date=date(2024, 1, 1), count=3)
        later = EggLogFactory(household=hh, created_by=owner, date=date(2024, 6, 1), count=5)
        url = reverse("chicken-egg-log-list") + "?date_from=2024-05-01"
        response = _client_for(owner).get(url)
        assert response.status_code == status.HTTP_200_OK
        ids = [str(e["id"]) for e in response.data]
        assert str(later.id) in ids
        assert not any("2024-01-01" == e["date"] for e in response.data)

    def test_date_to_excludes_later_logs(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        early = EggLogFactory(household=hh, created_by=owner, date=date(2024, 1, 1), count=3)
        EggLogFactory(household=hh, created_by=owner, date=date(2024, 6, 1), count=5)
        url = reverse("chicken-egg-log-list") + "?date_to=2024-03-31"
        response = _client_for(owner).get(url)
        ids = [str(e["id"]) for e in response.data]
        assert str(early.id) in ids
        assert not any("2024-06-01" == e["date"] for e in response.data)


# ===========================================================================
# 4. EggLog stats endpoint (US-4)
# ===========================================================================


@pytest.mark.django_db
class TestEggLogStats:
    """GET /api/chickens/egg-logs/stats/ — today, avg_7d, avg_30d, month_total, series."""

    def test_stats_shape(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).get(reverse("chicken-egg-log-stats"))
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert "today" in data
        assert "avg_7d" in data
        assert "avg_30d" in data
        assert "month_total" in data
        assert "series" in data
        assert len(data["series"]) == 30

    def test_series_has_null_for_missing_days(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).get(reverse("chicken-egg-log-stats"))
        series = response.data["series"]
        # No logs → all counts are null
        assert all(point["count"] is None for point in series)

    def test_today_reflects_todays_log(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        today = timezone.localdate()
        EggLogFactory(household=hh, created_by=owner, date=today, count=6)
        response = _client_for(owner).get(reverse("chicken-egg-log-stats"))
        assert response.data["today"] == 6

    def test_avg_7d_excludes_days_without_logs(self):
        """Days with no log entry are excluded from the average, not counted as 0."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        today = timezone.localdate()
        # Log exactly 2 days in the last 7
        EggLogFactory(household=hh, created_by=owner, date=today, count=4)
        EggLogFactory(household=hh, created_by=owner, date=today - timedelta(days=2), count=8)
        response = _client_for(owner).get(reverse("chicken-egg-log-stats"))
        # avg = (4+8)/2 = 6.0, NOT (4+8)/7
        assert response.data["avg_7d"] == 6.0

    def test_stats_isolated_by_household(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        today = timezone.localdate()
        EggLogFactory(household=hh_b, created_by=owner_b, date=today, count=99)
        response = _client_for(owner_a).get(reverse("chicken-egg-log-stats"))
        assert response.data["today"] is None  # hh_a has no logs

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("chicken-egg-log-stats"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 5. ChickenEventViewSet (US-5 / US-6)
# ===========================================================================


@pytest.mark.django_db
class TestChickenEventCreate:
    """POST /api/chickens/events/ — creates a journal entry."""

    def _event_payload(self, **overrides):
        payload = {
            "type": "care",
            "title": "Worming treatment",
            "occurred_on": "2024-06-10",
        }
        payload.update(overrides)
        return payload

    def test_owner_creates_event(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(
            reverse("chicken-event-list"), self._event_payload(), format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        event = ChickenEvent.objects.get(id=response.data["id"])
        assert event.household == hh
        assert event.type == "care"

    def test_member_can_create_event(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        response = _client_for(member).post(
            reverse("chicken-event-list"), self._event_payload(), format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_anonymous_gets_401(self):
        response = _anon_client().post(
            reverse("chicken-event-list"), self._event_payload(), format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_blank_title_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(
            reverse("chicken-event-list"),
            self._event_payload(title="   "),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "title" in response.data

    def test_chicken_from_other_household_returns_400(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        chicken_b = ChickenFactory(household=hh_b, created_by=owner_b)
        response = _client_for(owner_a).post(
            reverse("chicken-event-list"),
            self._event_payload(chicken=str(chicken_b.id)),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "chicken" in response.data

    def test_care_event_with_reminder_creates_task(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        due = str(timezone.localdate() + timedelta(days=7))
        response = _client_for(owner).post(
            reverse("chicken-event-list"),
            self._event_payload(type="care", reminder_due_date=due),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        event = ChickenEvent.objects.get(id=response.data["id"])
        task = Task.objects.filter(household=hh, subject=event.title).first()
        assert task is not None
        assert str(task.due_date) == due

    def test_event_without_reminder_does_not_create_task(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        before = Task.objects.filter(household=hh).count()
        _client_for(owner).post(
            reverse("chicken-event-list"), self._event_payload(), format="json"
        )
        assert Task.objects.filter(household=hh).count() == before

    def test_filter_by_chicken(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken_a = ChickenFactory(household=hh, created_by=owner)
        chicken_b = ChickenFactory(household=hh, created_by=owner)
        ChickenEventFactory(household=hh, created_by=owner, chicken=chicken_a)
        ChickenEventFactory(household=hh, created_by=owner, chicken=chicken_b)
        url = reverse("chicken-event-list") + f"?chicken={chicken_a.id}"
        response = _client_for(owner).get(url)
        assert response.status_code == status.HTTP_200_OK
        assert all(str(e["chicken"]) == str(chicken_a.id) for e in response.data)


@pytest.mark.django_db
class TestChickenEventCRUD:
    """GET/PATCH/DELETE /api/chickens/events/{id}/."""

    def test_retrieve(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        event = ChickenEventFactory(household=hh, created_by=owner, title="Check-up")
        response = _client_for(owner).get(reverse("chicken-event-detail", args=[event.id]))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == "Check-up"

    def test_cross_household_retrieve_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        event_b = ChickenEventFactory(household=hh_b, created_by=owner_b)
        response = _client_for(owner_a).get(reverse("chicken-event-detail", args=[event_b.id]))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_patch_title(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        event = ChickenEventFactory(household=hh, created_by=owner, title="Old")
        response = _client_for(owner).patch(
            reverse("chicken-event-detail", args=[event.id]),
            {"title": "New title"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        event.refresh_from_db()
        assert event.title == "New title"

    def test_delete(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        event = ChickenEventFactory(household=hh, created_by=owner)
        response = _client_for(owner).delete(reverse("chicken-event-detail", args=[event.id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ChickenEvent.objects.filter(id=event.id).exists()

    def test_cross_household_delete_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        event_b = ChickenEventFactory(household=hh_b, created_by=owner_b)
        response = _client_for(owner_a).delete(reverse("chicken-event-detail", args=[event_b.id]))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert ChickenEvent.objects.filter(id=event_b.id).exists()


# ===========================================================================
# 6. Purchase action (US-7)
# ===========================================================================


@pytest.mark.django_db
class TestChickenPurchase:
    """POST /api/chickens/{id}/purchase/ — creates an expense Interaction."""

    def _purchase_payload(self, **overrides):
        payload = {
            "amount": "35.00",
            "supplier": "Ferme du coin",
            "occurred_at": "2024-06-01T10:00:00Z",
            "notes": "3 new hens",
        }
        payload.update(overrides)
        return payload

    def test_purchase_creates_interaction(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner)
        response = _client_for(owner).post(
            reverse("chicken-purchase", args=[chicken.id]),
            self._purchase_payload(),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert "interaction_id" in response.data
        interaction = Interaction.objects.get(id=response.data["interaction_id"])
        assert interaction.household == hh
        assert interaction.type == "expense"
        assert interaction.metadata["kind"] == "chickens_purchase"

    def test_purchase_stores_amount_in_metadata(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner)
        response = _client_for(owner).post(
            reverse("chicken-purchase", args=[chicken.id]),
            self._purchase_payload(amount="99.50"),
            format="json",
        )
        interaction = Interaction.objects.get(id=response.data["interaction_id"])
        assert Decimal(interaction.metadata["amount"]) == Decimal("99.50")

    def test_purchase_without_amount_accepted(self):
        """amount is optional on the purchase payload."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner)
        response = _client_for(owner).post(
            reverse("chicken-purchase", args=[chicken.id]),
            {"supplier": "Ferme"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_cross_household_purchase_returns_404(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        chicken_b = ChickenFactory(household=hh_b, created_by=owner_b)
        response = _client_for(owner_a).post(
            reverse("chicken-purchase", args=[chicken_b.id]),
            self._purchase_payload(),
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner)
        response = _anon_client().post(
            reverse("chicken-purchase", args=[chicken.id]),
            self._purchase_payload(),
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 7. ChickenSettingsView (US-8)
# ===========================================================================


@pytest.mark.django_db
class TestChickenSettingsView:
    """GET/PUT /api/chickens/settings/ — module settings, feed stock item validation."""

    def test_get_creates_settings_if_missing(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        assert not ChickenSettings.objects.filter(household=hh).exists()
        response = _client_for(owner).get(reverse("chicken-settings"))
        assert response.status_code == status.HTTP_200_OK
        assert ChickenSettings.objects.filter(household=hh).exists()

    def test_get_is_idempotent(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        _client_for(owner).get(reverse("chicken-settings"))
        _client_for(owner).get(reverse("chicken-settings"))
        assert ChickenSettings.objects.filter(household=hh).count() == 1

    def test_put_valid_stock_item(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        item = _create_stock_item(hh, owner)
        response = _client_for(owner).put(
            reverse("chicken-settings"),
            {"feed_stock_item": str(item.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        settings = ChickenSettings.objects.get(household=hh)
        assert settings.feed_stock_item == item
        detail = response.data["feed_stock_item_detail"]
        assert detail["name"] == item.name
        assert detail["quantity"] == "20.000"
        assert detail["unit"] == "kg"
        assert detail["status"] == item.status
        assert detail["min_quantity"] == "5.000"

    def test_put_item_from_other_household_returns_400(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        item_b = _create_stock_item(hh_b, owner_b)
        response = _client_for(owner_a).put(
            reverse("chicken-settings"),
            {"feed_stock_item": str(item_b.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "feed_stock_item" in response.data

    def test_put_null_feed_stock_item_clears_link(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        item = _create_stock_item(hh, owner)
        ChickenSettings.objects.create(household=hh, feed_stock_item=item)
        response = _client_for(owner).put(
            reverse("chicken-settings"),
            {"feed_stock_item": None},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        settings = ChickenSettings.objects.get(household=hh)
        assert settings.feed_stock_item is None

    def test_deleted_stock_item_clears_link(self):
        # Lesson from the feed_tracker bug: never show a dead link. StockItem
        # delete is a hard delete, so SET_NULL must clear the reference.
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        item = _create_stock_item(hh, owner)
        ChickenSettings.objects.create(household=hh, feed_stock_item=item)
        item.delete()
        response = _client_for(owner).get(reverse("chicken-settings"))
        assert response.data["feed_stock_item"] is None
        assert response.data["feed_stock_item_detail"] is None

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("chicken-settings"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# 8. ChickenSummaryView (US-9/US-10)
# ===========================================================================


@pytest.mark.django_db
class TestChickenSummaryView:
    """GET /api/chickens/summary/ — active_count, eggs_today, eggs_7d, feed, cost, has_data."""

    def test_summary_shape_empty_household(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).get(reverse("chicken-summary"))
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert "active_count" in data
        assert "eggs_today" in data
        assert "eggs_7d" in data
        assert "feed" in data
        assert "cost" in data
        assert "has_data" in data
        assert data["has_data"] is False

    def test_active_count_correct(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.ACTIVE)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.BROODY)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.SICK)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.DECEASED)
        response = _client_for(owner).get(reverse("chicken-summary"))
        assert response.data["active_count"] == 3  # active + broody + sick

    def test_eggs_today_reflects_current_day_log(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        today = timezone.localdate()
        EggLogFactory(household=hh, created_by=owner, date=today, count=5)
        response = _client_for(owner).get(reverse("chicken-summary"))
        assert response.data["eggs_today"] == 5

    def test_eggs_7d_sums_last_7_days(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        today = timezone.localdate()
        EggLogFactory(household=hh, created_by=owner, date=today, count=3)
        EggLogFactory(household=hh, created_by=owner, date=today - timedelta(days=3), count=4)
        EggLogFactory(household=hh, created_by=owner, date=today - timedelta(days=10), count=99)
        response = _client_for(owner).get(reverse("chicken-summary"))
        assert response.data["eggs_7d"] == 7  # 3+4, the 99 is beyond 7 days

    def test_feed_section_present_when_stock_item_configured(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        item = _create_stock_item(hh, owner)
        ChickenSettings.objects.create(household=hh, feed_stock_item=item)
        response = _client_for(owner).get(reverse("chicken-summary"))
        feed = response.data["feed"]
        assert feed is not None
        assert str(feed["stock_item_id"]) == str(item.id)
        assert feed["name"] == item.name
        assert feed["quantity"] == "20.000"
        assert feed["unit"] == "kg"
        assert feed["status"] == item.status
        assert feed["min_quantity"] == "5.000"

    def test_feed_section_null_after_stock_item_deleted(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        item = _create_stock_item(hh, owner)
        ChickenSettings.objects.create(household=hh, feed_stock_item=item)
        item.delete()
        response = _client_for(owner).get(reverse("chicken-summary"))
        assert response.data["feed"] is None

    def test_cost_includes_stock_purchases_of_linked_item(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        item = _create_stock_item(hh, owner)
        other_item = _create_stock_item(hh, owner, name="Straw")
        ChickenSettings.objects.create(household=hh, feed_stock_item=item)
        client = _client_for(owner)
        # Module purchase (hen) + stock purchase of the linked feed item
        chicken = ChickenFactory(household=hh, created_by=owner)
        client.post(
            reverse("chicken-purchase", args=[chicken.id]),
            {"amount": "10.00"},
            format="json",
        )
        client.post(
            reverse("stock-item-purchase", args=[item.id]),
            {"delta": "25", "amount": "30.00"},
            format="json",
        )
        # Purchase of an UNLINKED item must not be attributed
        client.post(
            reverse("stock-item-purchase", args=[other_item.id]),
            {"delta": "5", "amount": "99.00"},
            format="json",
        )
        response = client.get(reverse("chicken-summary"))
        assert Decimal(response.data["cost"]["total"]) == Decimal("40.00")

    def test_cost_total_from_chickens_purchase_interactions(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        chicken = ChickenFactory(household=hh, created_by=owner)
        # Create a purchase via the API so the Interaction is wired correctly
        _client_for(owner).post(
            reverse("chicken-purchase", args=[chicken.id]),
            {"amount": "50.00", "occurred_at": "2024-01-10T10:00:00Z"},
            format="json",
        )
        _client_for(owner).post(
            reverse("chicken-purchase", args=[chicken.id]),
            {"amount": "25.00", "occurred_at": "2024-03-10T10:00:00Z"},
            format="json",
        )
        response = _client_for(owner).get(reverse("chicken-summary"))
        assert Decimal(response.data["cost"]["total"]) == Decimal("75.00")

    def test_has_data_true_when_chickens_exist(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        ChickenFactory(household=hh, created_by=owner, status=Chicken.Status.ACTIVE)
        response = _client_for(owner).get(reverse("chicken-summary"))
        assert response.data["has_data"] is True

    def test_summary_isolated_by_household(self):
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_a = _make_owner(hh_a)
        owner_b = _make_owner(hh_b)
        ChickenFactory(household=hh_b, created_by=owner_b, status=Chicken.Status.ACTIVE)
        today = timezone.localdate()
        EggLogFactory(household=hh_b, created_by=owner_b, date=today, count=10)
        response = _client_for(owner_a).get(reverse("chicken-summary"))
        assert response.data["active_count"] == 0
        assert response.data["eggs_today"] is None

    def test_anonymous_gets_401(self):
        response = _anon_client().get(reverse("chicken-summary"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
