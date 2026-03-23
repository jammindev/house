# electricity/tests/factories.py
"""Factory-boy factories for the electricity app."""

import uuid
from datetime import date

import factory
from django.contrib.auth import get_user_model

from electricity.models import (
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    MaintenanceEvent,
    ProtectiveDevice,
    UsagePoint,
)
from households.models import Household, HouseholdMember
from zones.models import Zone


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = get_user_model()

    email = factory.LazyFunction(lambda: f"user-{uuid.uuid4()}@example.com")
    password = "pass1234"

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "pass1234")
        return model_class.objects.create_user(password=password, *args, **kwargs)


class HouseholdFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Household

    name = factory.Sequence(lambda n: f"Maison {n}")


class HouseholdMemberFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = HouseholdMember

    household = factory.SubFactory(HouseholdFactory)
    user = factory.SubFactory(UserFactory)
    role = HouseholdMember.Role.MEMBER


class ZoneFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Zone

    household = factory.SubFactory(HouseholdFactory)
    name = factory.Sequence(lambda n: f"Zone {n}")
    created_by = factory.SubFactory(UserFactory)


class ElectricityBoardFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ElectricityBoard

    household = factory.SubFactory(HouseholdFactory)
    zone = factory.SubFactory(ZoneFactory, household=factory.SelfAttribute("..household"))
    name = factory.Sequence(lambda n: f"Tableau {n}")
    supply_type = "single_phase"
    is_active = True
    parent = None
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")


class ProtectiveDeviceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ProtectiveDevice

    board = factory.SubFactory(ElectricityBoardFactory)
    household = factory.SelfAttribute("board.household")
    label = factory.Sequence(lambda n: f"D-{n}")
    device_type = "breaker"
    rating_amps = 20
    curve_type = "c"
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")


class ElectricCircuitFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ElectricCircuit

    board = factory.SubFactory(ElectricityBoardFactory)
    household = factory.SelfAttribute("board.household")
    protective_device = factory.SubFactory(
        ProtectiveDeviceFactory,
        board=factory.SelfAttribute("..board"),
        household=factory.SelfAttribute("..household"),
    )
    label = factory.Sequence(lambda n: f"CIR-{n}")
    name = factory.Sequence(lambda n: f"Circuit {n}")
    is_active = True
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")


class UsagePointFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = UsagePoint

    household = factory.SubFactory(HouseholdFactory)
    zone = factory.SubFactory(ZoneFactory, household=factory.SelfAttribute("..household"))
    label = factory.Sequence(lambda n: f"UP-{n}")
    name = factory.Sequence(lambda n: f"Point {n}")
    kind = "socket"
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")


class CircuitUsagePointLinkFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CircuitUsagePointLink

    circuit = factory.SubFactory(ElectricCircuitFactory)
    household = factory.SelfAttribute("circuit.household")
    usage_point = factory.SubFactory(
        UsagePointFactory,
        household=factory.SelfAttribute("..circuit.household"),
    )
    is_active = True
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")


class MaintenanceEventFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = MaintenanceEvent

    household = factory.SubFactory(HouseholdFactory)
    board = None
    performed_by = None
    event_date = factory.LazyFunction(date.today)
    description = factory.Sequence(lambda n: f"Maintenance event {n}")
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")
