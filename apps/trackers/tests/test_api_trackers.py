from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from projects.models import Project
from trackers import services
from trackers.models import Tracker, TrackerEntry

from .factories import TrackerFactory


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return UserFactory(email="trackers-api@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Trackers API House")
    HouseholdMember.objects.create(user=owner, household=hh, role=HouseholdMember.Role.OWNER)
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


@pytest.fixture
def stranger_client(db):
    stranger = UserFactory(email="trackers-stranger@example.com")
    hh = Household.objects.create(name="Stranger House")
    HouseholdMember.objects.create(user=stranger, household=hh, role=HouseholdMember.Role.OWNER)
    stranger.active_household = hh
    stranger.save(update_fields=["active_household"])
    client = APIClient()
    client.force_authenticate(user=stranger)
    return client


def _results(response):
    data = response.json()
    return data["results"] if isinstance(data, dict) and "results" in data else data


# ── Tracker CRUD ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrackerCrud:
    def test_create_general_tracker(self, owner_client, household, owner):
        response = owner_client.post(
            reverse("tracker-list"),
            {"name": "Compteur d'eau", "unit": "m³", "emoji": "💧"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        tracker = Tracker.objects.get(id=response.json()["id"])
        assert tracker.household == household
        assert tracker.created_by == owner

    def test_delete_archives_instead_of_destroying(self, owner_client, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        response = owner_client.delete(reverse("tracker-detail", args=[tracker.id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        tracker.refresh_from_db()
        assert tracker.is_active is False

    def test_stranger_cannot_see_trackers(self, stranger_client, household, owner):
        TrackerFactory(household=household, created_by=owner)
        response = stranger_client.get(reverse("tracker-list"))
        assert response.status_code == status.HTTP_200_OK
        assert _results(response) == []


# ── Filters ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrackerFilters:
    @pytest.fixture
    def dataset(self, household, owner):
        project = Project.objects.create(
            household=household, title="Réno", created_by=owner
        )
        general = TrackerFactory(household=household, created_by=owner, name="Poids")
        in_project = TrackerFactory(
            household=household, created_by=owner, name="Budget", project=project
        )
        archived = TrackerFactory(
            household=household, created_by=owner, name="Archivé", is_active=False
        )
        return {
            "project": project,
            "general": general, "in_project": in_project,
            "archived": archived,
        }

    def test_default_hides_archived(self, owner_client, dataset):
        names = {t["name"] for t in _results(owner_client.get(reverse("tracker-list")))}
        assert names == {"Poids", "Budget"}

    def test_include_archived(self, owner_client, dataset):
        response = owner_client.get(reverse("tracker-list"), {"include_archived": "1"})
        assert {t["name"] for t in _results(response)} == {"Poids", "Budget", "Archivé"}

    def test_filter_by_project(self, owner_client, dataset):
        response = owner_client.get(
            reverse("tracker-list"), {"project": str(dataset["project"].id)}
        )
        assert [t["name"] for t in _results(response)] == ["Budget"]

    def test_filter_general(self, owner_client, dataset):
        response = owner_client.get(reverse("tracker-list"), {"general": "true"})
        assert [t["name"] for t in _results(response)] == ["Poids"]


# ── Entries ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEntryApi:
    def test_create_entry_defaults_occurred_at_and_refreshes_cache(
        self, owner_client, household, owner
    ):
        tracker = TrackerFactory(household=household, created_by=owner)
        response = owner_client.post(
            reverse("tracker-entry-list"),
            {"tracker": str(tracker.id), "value": "148.2"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["occurred_at"] is not None
        tracker.refresh_from_db()
        assert tracker.last_value == Decimal("148.2")
        assert "148.2" in tracker.entries_summary

    def test_create_entry_rejects_foreign_tracker(self, owner_client, household, owner):
        other = Household.objects.create(name="Elsewhere")
        foreign = TrackerFactory(household=other, created_by=owner)
        response = owner_client.post(
            reverse("tracker-entry-list"),
            {"tracker": str(foreign.id), "value": "1"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_entry_refreshes_cache(self, owner_client, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        entry = services.add_entry(household, owner, tracker, value="10")
        response = owner_client.patch(
            reverse("tracker-entry-detail", args=[entry.id]),
            {"value": "12.5"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        tracker.refresh_from_db()
        assert tracker.last_value == Decimal("12.5")

    def test_delete_entry_is_hard_and_refreshes_cache(self, owner_client, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        entry = services.add_entry(household, owner, tracker, value="10")
        response = owner_client.delete(reverse("tracker-entry-detail", args=[entry.id]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert TrackerEntry.objects.filter(pk=entry.pk).count() == 0
        tracker.refresh_from_db()
        assert tracker.last_value is None

    def test_list_entries_filtered_by_tracker(self, owner_client, household, owner):
        t1 = TrackerFactory(household=household, created_by=owner)
        t2 = TrackerFactory(household=household, created_by=owner)
        services.add_entry(household, owner, t1, value="1")
        services.add_entry(household, owner, t2, value="2")
        response = owner_client.get(reverse("tracker-entry-list"), {"tracker": str(t1.id)})
        results = _results(response)
        assert len(results) == 1
        assert results[0]["value"] == "1.000"


# ── Sparkline ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSparkline:
    def test_sparkline_chronological_capped_at_30(self, owner_client, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        base = timezone.now() - timedelta(days=40)
        for i in range(35):
            services.add_entry(
                household, owner, tracker,
                value=str(i), occurred_at=base + timedelta(days=i),
            )
        response = owner_client.get(reverse("tracker-list"))
        sparkline = _results(response)[0]["sparkline"]
        assert len(sparkline) == 30
        values = [Decimal(p["value"]) for p in sparkline]
        assert values == sorted(values)  # chronological
        assert values[-1] == Decimal("34")

    def test_list_query_count_is_flat(
        self, owner_client, household, owner, django_assert_max_num_queries
    ):
        for _ in range(5):
            tracker = TrackerFactory(household=household, created_by=owner)
            services.add_entry(household, owner, tracker, value="1")
        # Whatever the fixed cost (auth, household, count), the entries must not
        # add one query per tracker — the sliced prefetch keeps the total flat.
        with django_assert_max_num_queries(12):
            response = owner_client.get(reverse("tracker-list"))
        assert len(_results(response)) == 5
