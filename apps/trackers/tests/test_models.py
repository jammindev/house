from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from trackers.models import Tracker, TrackerEntry

from .factories import TrackerEntryFactory, TrackerFactory


@pytest.fixture
def owner(db):
    return UserFactory(email="trackers-models@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Trackers House")
    HouseholdMember.objects.create(user=owner, household=hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.mark.django_db
class TestTrackerModel:
    def test_requires_household(self, owner):
        with pytest.raises(ValueError):
            Tracker(name="No household", created_by=owner).save()

    def test_household_scoping(self, household, owner):
        other = Household.objects.create(name="Other House")
        TrackerFactory(household=household, created_by=owner, name="Mine")
        TrackerFactory(household=other, created_by=owner, name="Theirs")
        names = list(
            Tracker.objects.for_household(household.id).values_list('name', flat=True)
        )
        assert names == ["Mine"]

    def test_ordering_by_last_entry_at_desc(self, household, owner):
        now = timezone.now()
        stale = TrackerFactory(household=household, created_by=owner, name="Stale")
        fresh = TrackerFactory(household=household, created_by=owner, name="Fresh")
        Tracker.objects.filter(pk=stale.pk).update(last_entry_at=now - timedelta(days=30))
        Tracker.objects.filter(pk=fresh.pk).update(last_entry_at=now)
        assert list(Tracker.objects.filter(household=household))[0].name == "Fresh"


@pytest.mark.django_db
class TestTrackerEntryModel:
    def test_entries_ordered_by_occurred_at_desc(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        now = timezone.now()
        old = TrackerEntryFactory(
            tracker=tracker, household=household, created_by=owner,
            value=1, occurred_at=now - timedelta(days=2),
        )
        recent = TrackerEntryFactory(
            tracker=tracker, household=household, created_by=owner,
            value=2, occurred_at=now,
        )
        assert list(tracker.entries.all()) == [recent, old]

    def test_cascade_delete_with_tracker(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        TrackerEntryFactory(tracker=tracker, household=household, created_by=owner)
        tracker.delete()
        assert TrackerEntry.objects.count() == 0
