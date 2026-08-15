# orchard/tests/factories.py
"""Factory-boy factories for the orchard app."""

import uuid
from datetime import date
from decimal import Decimal

import factory
from django.contrib.auth import get_user_model
from factory.django import DjangoModelFactory

from households.models import Household, HouseholdMember
from orchard.models import Harvest, Tree, TreeEvent
from zones.models import Zone


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

    name = factory.Sequence(lambda n: f"Verger {n}")


class HouseholdMemberFactory(DjangoModelFactory):
    class Meta:
        model = HouseholdMember

    household = factory.SubFactory(HouseholdFactory)
    user = factory.SubFactory(UserFactory)
    role = HouseholdMember.Role.MEMBER


class ZoneFactory(DjangoModelFactory):
    class Meta:
        model = Zone
        skip_postgeneration_save = True

    name = factory.Sequence(lambda n: f"Jardin {n}")
    # household must be provided by each test


class TreeFactory(DjangoModelFactory):
    class Meta:
        model = Tree
        skip_postgeneration_save = True

    name = factory.Sequence(lambda n: f"Pommier {n}")
    kind = Tree.Kind.FRUIT_TREE
    species = "Reine des Reinettes"
    rootstock = ""
    planted_on = factory.LazyFunction(lambda: date(2015, 3, 1))
    status = Tree.Status.ALIVE
    notes = ""
    # household, zone and created_by must be provided by each test


class TreeEventFactory(DjangoModelFactory):
    class Meta:
        model = TreeEvent
        skip_postgeneration_save = True

    type = TreeEvent.Type.PRUNING
    occurred_on = factory.LazyFunction(lambda: date(2026, 1, 15))
    title = factory.Sequence(lambda n: f"Taille {n}")
    notes = ""
    # household, tree and created_by must be provided by each test


class HarvestFactory(DjangoModelFactory):
    class Meta:
        model = Harvest
        skip_postgeneration_save = True

    harvested_on = factory.LazyFunction(lambda: date(2026, 9, 20))
    quantity = Decimal("12.500")
    unit = Harvest.Unit.KG
    notes = ""
    # household, tree and created_by must be provided by each test
