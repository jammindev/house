"""
Tests for consumption trackers — parcours 11, lot 6 (#214, #216).

Covers:
  - reserve adjustment on entry create / update / delete (the undo path)
  - rate_per_day over the sliding window (backdating included)
  - runway (days + end date) and its degenerate cases
  - consumption entries_summary (rate — reserve — runway header)
  - kind immutability, measure trackers untouched
  - API: reserve PATCH refreshes the summary, daily-totals sparkline
  - agent: create with kind/reserve, dictated entry decrements, refill update
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent import tools
from households.models import Household, HouseholdMember
from trackers import services
from trackers.models import Tracker, TrackerEntry

from .factories import TrackerFactory


@pytest.fixture
def owner(db):
    return UserFactory(email="trackers-consumption@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Consumption House")
    HouseholdMember.objects.create(user=owner, household=hh, role=HouseholdMember.Role.OWNER)
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def feed(household, owner):
    """🐔 Nourriture poules — verres, réserve 36."""
    return TrackerFactory(
        household=household, created_by=owner,
        name="Nourriture poules", unit="verres", emoji="🐔",
        kind=Tracker.Kind.CONSUMPTION, reserve=Decimal("36"),
    )


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


# ── Reserve adjustments ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReserve:
    def test_add_entry_decrements_reserve(self, household, owner, feed):
        services.add_entry(household, owner, feed, value="3")
        feed.refresh_from_db()
        assert feed.reserve == Decimal("33")

    def test_update_entry_adjusts_delta(self, household, owner, feed):
        entry = services.add_entry(household, owner, feed, value="3")
        services.update_entry(household, owner, entry, fields={"value": "5"})
        feed.refresh_from_db()
        assert feed.reserve == Decimal("31")  # 36 - 5

    def test_delete_entry_recredits(self, household, owner, feed):
        entry = services.add_entry(household, owner, feed, value="3")
        services.delete_entry(household, owner, entry)
        feed.refresh_from_db()
        assert feed.reserve == Decimal("36")

    def test_reserve_may_go_negative(self, household, owner, feed):
        services.add_entry(household, owner, feed, value="40")
        feed.refresh_from_db()
        assert feed.reserve == Decimal("-4")

    def test_no_reserve_declared_is_noop(self, household, owner):
        tracker = TrackerFactory(
            household=household, created_by=owner,
            kind=Tracker.Kind.CONSUMPTION, reserve=None,
        )
        services.add_entry(household, owner, tracker, value="3")
        tracker.refresh_from_db()
        assert tracker.reserve is None

    def test_measure_tracker_untouched(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)  # measure
        services.add_entry(household, owner, tracker, value="148.2")
        tracker.refresh_from_db()
        assert tracker.kind == Tracker.Kind.MEASURE
        assert tracker.reserve is None
        assert tracker.rate_per_day is None
        assert "latest: 148.2" in tracker.entries_summary  # V1 summary unchanged


# ── Rate & runway ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRateAndRunway:
    def test_rate_over_covered_days(self, household, owner, feed):
        now = timezone.now()
        services.add_entry(household, owner, feed, value="3", occurred_at=now - timedelta(days=2))
        services.add_entry(household, owner, feed, value="3", occurred_at=now - timedelta(days=1))
        services.add_entry(household, owner, feed, value="3", occurred_at=now)
        feed.refresh_from_db()
        # 9 verres over 2 days of coverage → 4.5/day
        assert feed.rate_per_day == Decimal("4.500")

    def test_single_recent_entry_floors_coverage_at_one_day(self, household, owner, feed):
        services.add_entry(household, owner, feed, value="3")
        feed.refresh_from_db()
        assert feed.rate_per_day == Decimal("3.000")

    def test_entries_outside_window_ignored(self, household, owner, feed):
        now = timezone.now()
        services.add_entry(household, owner, feed, value="99", occurred_at=now - timedelta(days=40))
        services.add_entry(household, owner, feed, value="3", occurred_at=now)
        feed.refresh_from_db()
        assert feed.rate_per_day == Decimal("3.000")

    def test_runway_from_reserve_and_rate(self, household, owner, feed):
        now = timezone.now()
        services.add_entry(household, owner, feed, value="3", occurred_at=now - timedelta(days=1))
        services.add_entry(household, owner, feed, value="3", occurred_at=now)
        feed.refresh_from_db()
        run = services.runway(feed)
        assert run is not None
        days, until = run
        # reserve 30 / 6-per-covered-day → 5 days
        assert days == Decimal("5.0")
        assert until.date() == (now + timedelta(days=5)).date()

    def test_runway_none_without_reserve_or_rate(self, household, owner):
        no_reserve = TrackerFactory(
            household=household, created_by=owner, kind=Tracker.Kind.CONSUMPTION
        )
        services.add_entry(household, owner, no_reserve, value="3")
        no_reserve.refresh_from_db()
        assert services.runway(no_reserve) is None

        no_entries = TrackerFactory(
            household=household, created_by=owner,
            kind=Tracker.Kind.CONSUMPTION, reserve=Decimal("10"),
        )
        assert services.runway(no_entries) is None

    def test_summary_carries_rate_reserve_runway(self, household, owner, feed):
        now = timezone.now()
        services.add_entry(household, owner, feed, value="3", occurred_at=now - timedelta(days=1))
        services.add_entry(household, owner, feed, value="3", occurred_at=now)
        feed.refresh_from_db()
        header = feed.entries_summary.splitlines()[0]
        assert "Rate: ≈6 verres/day" in header
        assert "reserve: 30 verres" in header
        assert "runway: ~5 days" in header
        # Consumption lines carry no deltas.
        assert "(+" not in feed.entries_summary

    def test_reserve_update_refreshes_summary(self, household, owner, feed):
        services.add_entry(household, owner, feed, value="3")
        services.update_tracker(household, owner, feed, fields={"reserve": "93"})
        feed.refresh_from_db()
        assert feed.reserve == Decimal("93")
        assert "reserve: 93 verres" in feed.entries_summary


# ── Kind immutability ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestKind:
    def test_kind_immutable_via_service(self, household, owner, feed):
        # 'kind' is not in the allowed update fields — silently dropped.
        services.update_tracker(household, owner, feed, fields={"kind": "measure"})
        feed.refresh_from_db()
        assert feed.kind == Tracker.Kind.CONSUMPTION

    def test_kind_immutable_via_api(self, owner_client, household, feed):
        response = owner_client.patch(
            reverse("tracker-detail", args=[feed.id]), {"kind": "measure"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── API ──────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestConsumptionApi:
    def test_create_consumption_tracker(self, owner_client, household):
        response = owner_client.post(
            reverse("tracker-list"),
            {"name": "Granulés", "unit": "kg", "kind": "consumption", "reserve": "15"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["kind"] == "consumption"
        assert body["reserve"] == "15.000"

    def test_entry_decrements_and_exposes_runway(self, owner_client, household, owner, feed):
        now = timezone.now()
        services.add_entry(household, owner, feed, value="3", occurred_at=now - timedelta(days=1))
        services.add_entry(household, owner, feed, value="3", occurred_at=now)
        response = owner_client.get(reverse("tracker-detail", args=[feed.id]))
        body = response.json()
        assert body["reserve"] == "30.000"
        assert body["rate_per_day"] == "6.000"
        assert body["runway_days"] == "5.0"
        assert body["runway_until"] is not None

    def test_reserve_patch_refreshes_summary(self, owner_client, household, owner, feed):
        services.add_entry(household, owner, feed, value="3")
        response = owner_client.patch(
            reverse("tracker-detail", args=[feed.id]), {"reserve": "93"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        feed.refresh_from_db()
        assert "reserve: 93 verres" in feed.entries_summary

    def test_sparkline_is_daily_totals(self, owner_client, household, owner, feed):
        now = timezone.now()
        day = now - timedelta(days=1)
        services.add_entry(household, owner, feed, value="2", occurred_at=day.replace(hour=8))
        services.add_entry(household, owner, feed, value="1", occurred_at=day.replace(hour=18))
        services.add_entry(household, owner, feed, value="3", occurred_at=now)
        response = owner_client.get(reverse("tracker-detail", args=[feed.id]))
        sparkline = response.json()["sparkline"]
        assert len(sparkline) == 2  # two days, not three entries
        assert float(sparkline[0]["value"]) == 3.0  # 2 + 1


# ── Agent ────────────────────────────────────────────────────────────────────

def _dispatch(name, household, tool_input, user=None):
    return tools.dispatch(name, tool_input, household=household, user=user)


@pytest.mark.django_db
class TestConsumptionAgent:
    def test_create_consumption_tracker_via_agent(self, household, owner):
        result = _dispatch(
            "create_entity", household,
            {
                "entity_type": "tracker",
                "fields": {
                    "name": "Nourriture poules", "unit": "verres",
                    "kind": "consumption", "reserve": "36",
                },
            },
            user=owner,
        )
        tracker = Tracker.objects.get(pk=result.created[0]["id"])
        assert tracker.kind == Tracker.Kind.CONSUMPTION
        assert tracker.reserve == Decimal("36")

    def test_dictated_entry_decrements_reserve(self, household, owner, feed):
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker_entry", "fields": {"tracker": "poules", "value": "3"}},
            user=owner,
        )
        assert result.created
        feed.refresh_from_db()
        assert feed.reserve == Decimal("33")
        # The RAG answer to "combien de temps je tiens ?" lives in the summary.
        assert "runway" in feed.entries_summary

    def test_undo_recredits_reserve(self, household, owner, feed):
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker_entry", "fields": {"value": "3"}},
            user=owner,
        )
        entry = TrackerEntry.objects.get(pk=result.created[0]["id"])
        # The frontend undo goes through the DELETE endpoint → services.delete_entry.
        services.delete_entry(household, owner, entry)
        feed.refresh_from_db()
        assert feed.reserve == Decimal("36")

    def test_refill_via_update_entity(self, household, owner, feed):
        result = _dispatch(
            "update_entity", household,
            {"entity_type": "tracker", "id": str(feed.id), "fields": {"reserve": "96"}},
            user=owner,
        )
        assert result.updated
        assert result.updated[0]["previous"]["reserve"] == "36.000"
        feed.refresh_from_db()
        assert feed.reserve == Decimal("96")

    def test_list_describes_rate_and_runway(self, household, owner, feed):
        now = timezone.now()
        services.add_entry(household, owner, feed, value="3", occurred_at=now - timedelta(days=1))
        services.add_entry(household, owner, feed, value="3", occurred_at=now)
        result = _dispatch("list_entities", household, {"entity_type": "tracker"}, user=owner)
        assert "≈6 verres/day" in result.rendered
        assert "days left" in result.rendered
