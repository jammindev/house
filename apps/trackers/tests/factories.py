import factory
from django.utils import timezone
from factory.django import DjangoModelFactory

from trackers.models import Tracker, TrackerEntry


class TrackerFactory(DjangoModelFactory):
    class Meta:
        model = Tracker
        skip_postgeneration_save = True

    name = factory.Sequence(lambda n: f"Tracker {n}")
    description = ''
    unit = 'm³'
    emoji = '💧'
    is_active = True
    project = None
    # household and created_by must be provided by each test


class TrackerEntryFactory(DjangoModelFactory):
    class Meta:
        model = TrackerEntry
        skip_postgeneration_save = True

    value = factory.Sequence(lambda n: n + 1)
    occurred_at = factory.LazyFunction(timezone.now)
    note = ''
    # tracker, household and created_by must be provided by each test
