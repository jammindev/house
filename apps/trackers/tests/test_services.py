from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from projects.models import Project
from trackers import services
from trackers.models import TrackerEntry

from .factories import TrackerFactory


@pytest.fixture
def owner(db):
    return UserFactory(email="trackers-services@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Trackers Services House")
    HouseholdMember.objects.create(user=owner, household=hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def other_household(db):
    return Household.objects.create(name="Other House")


@pytest.mark.django_db
class TestCreateTracker:
    def test_create_general_tracker(self, household, owner):
        tracker = services.create_tracker(
            household, owner, name="Poids", unit="kg", emoji="⚖️"
        )
        assert tracker.household == household
        assert tracker.created_by == owner
        assert tracker.project is None

    def test_create_with_project(self, household, owner):
        project = Project.objects.create(
            household=household, title="Réno SDB", created_by=owner
        )
        tracker = services.create_tracker(
            household, owner, name="Budget peinture", unit="€", project=project
        )
        assert tracker.project == project

    def test_create_rejects_project_from_other_household(
        self, household, other_household, owner
    ):
        foreign = Project.objects.create(
            household=other_household, title="Pas chez moi", created_by=owner
        )
        with pytest.raises(ValidationError):
            services.create_tracker(household, owner, name="Interdit", project=foreign)


@pytest.mark.django_db
class TestUpdateTracker:
    def test_update_filters_disallowed_fields(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner, name="Avant")
        updated = services.update_tracker(
            household, owner, tracker,
            fields={"name": "Après", "last_value": "999", "household": "hack"},
        )
        assert updated.name == "Après"
        assert updated.last_value is None


@pytest.mark.django_db
class TestEntriesAndCache:
    def test_add_entry_refreshes_cache_and_summary(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner, unit="m³")
        services.add_entry(household, owner, tracker, value="142.3")
        entry = services.add_entry(
            household, owner, tracker, value="145.1", note="relevé mensuel"
        )

        tracker.refresh_from_db()
        assert tracker.last_value == Decimal("145.1")
        assert tracker.last_entry_at == entry.occurred_at
        assert "145.1" in tracker.entries_summary
        assert "(+2.8)" in tracker.entries_summary
        assert "relevé mensuel" in tracker.entries_summary

    def test_backdated_entry_does_not_override_latest(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        now = timezone.now()
        services.add_entry(household, owner, tracker, value="148.0", occurred_at=now)
        # Forgotten reading from last month, added afterwards.
        services.add_entry(
            household, owner, tracker,
            value="140.0", occurred_at=now - timedelta(days=30),
        )
        tracker.refresh_from_db()
        assert tracker.last_value == Decimal("148.0")

    def test_update_entry_refreshes_cache(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        entry = services.add_entry(household, owner, tracker, value="10")
        services.update_entry(household, owner, entry, fields={"value": "12.5"})
        tracker.refresh_from_db()
        assert tracker.last_value == Decimal("12.5")

    def test_delete_entry_refreshes_cache(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        now = timezone.now()
        services.add_entry(
            household, owner, tracker, value="1", occurred_at=now - timedelta(days=1)
        )
        latest = services.add_entry(household, owner, tracker, value="2", occurred_at=now)

        services.delete_entry(household, owner, latest)
        tracker.refresh_from_db()
        assert tracker.last_value == Decimal("1")
        assert TrackerEntry.objects.filter(tracker=tracker).count() == 1

    def test_delete_last_entry_empties_cache(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        entry = services.add_entry(household, owner, tracker, value="1")
        services.delete_entry(household, owner, entry)
        tracker.refresh_from_db()
        assert tracker.last_value is None
        assert tracker.last_entry_at is None
        assert tracker.entries_summary == ""

    def test_add_entry_rejects_foreign_tracker(self, household, other_household, owner):
        foreign = TrackerFactory(household=other_household, created_by=owner)
        with pytest.raises(ValidationError):
            services.add_entry(household, owner, foreign, value="1")

    def test_summary_limited_to_ten_entries_with_header(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner, unit="kWh")
        base = timezone.now() - timedelta(days=20)
        for i in range(12):
            services.add_entry(
                household, owner, tracker,
                value=str(100 + i), occurred_at=base + timedelta(days=i),
            )
        tracker.refresh_from_db()
        lines = tracker.entries_summary.splitlines()
        assert len(lines) == 1 + services.SUMMARY_ENTRIES
        assert lines[0].startswith("Unit: kWh — latest: 111")
        # Oldest two entries (100, 101) fell out of the summary window.
        assert "100 kWh" not in tracker.entries_summary
