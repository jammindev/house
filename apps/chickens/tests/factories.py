# chickens/tests/factories.py
"""Factory-boy factories for the chickens app."""

import uuid
from datetime import date

import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from chickens.models import Chicken, ChickenEvent, EggLog
from households.models import Household, HouseholdMember


class UserFactory(DjangoModelFactory):
    class Meta:
        model = get_user_model()

    email = factory.LazyFunction(lambda: f"user-{uuid.uuid4()}@example.com")
    password = "pass1234"

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "pass1234")
        return model_class.objects.create_user(password=password, *args, **kwargs)


class HouseholdFactory(DjangoModelFactory):
    class Meta:
        model = Household

    name = factory.Sequence(lambda n: f"Poulailler {n}")


class HouseholdMemberFactory(DjangoModelFactory):
    class Meta:
        model = HouseholdMember

    household = factory.SubFactory(HouseholdFactory)
    user = factory.SubFactory(UserFactory)
    role = HouseholdMember.Role.MEMBER


class ChickenFactory(DjangoModelFactory):
    class Meta:
        model = Chicken
        skip_postgeneration_save = True

    name = factory.Sequence(lambda n: f"Poule {n}")
    breed = "Leghorn"
    color = "white"
    hatched_on = None
    acquired_on = factory.LazyFunction(lambda: date(2024, 1, 1))
    status = Chicken.Status.ACTIVE
    notes = ""
    zone = None
    # household and created_by must be provided by each test


class EggLogFactory(DjangoModelFactory):
    class Meta:
        model = EggLog
        skip_postgeneration_save = True

    date = factory.Sequence(lambda n: date(2024, 1, 1 + n % 28))
    count = factory.Sequence(lambda n: n + 1)
    note = ""
    # household and created_by must be provided by each test


class ChickenEventFactory(DjangoModelFactory):
    class Meta:
        model = ChickenEvent
        skip_postgeneration_save = True

    chicken = None
    type = ChickenEvent.Type.CARE
    occurred_on = factory.LazyFunction(lambda: date(2024, 6, 1))
    title = factory.Sequence(lambda n: f"Event {n}")
    notes = ""
    # household and created_by must be provided by each test
