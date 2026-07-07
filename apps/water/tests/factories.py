# water/tests/factories.py
"""Factory-boy factories for the water app."""

import uuid
from datetime import date
from decimal import Decimal

import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from households.models import Household, HouseholdMember
from water.models import WaterReading


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

    name = factory.Sequence(lambda n: f"Maison {n}")


class HouseholdMemberFactory(DjangoModelFactory):
    class Meta:
        model = HouseholdMember

    household = factory.SubFactory(HouseholdFactory)
    user = factory.SubFactory(UserFactory)
    role = HouseholdMember.Role.MEMBER


class WaterReadingFactory(DjangoModelFactory):
    class Meta:
        model = WaterReading

    household = factory.SubFactory(HouseholdFactory)
    reading_date = factory.Sequence(lambda n: date(2024, 1, 1 + n % 28))
    index_m3 = factory.Sequence(lambda n: Decimal(str(100 + n * 10)))
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")
