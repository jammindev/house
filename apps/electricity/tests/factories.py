# electricity/tests/factories.py
import factory
import uuid
from django.contrib.auth import get_user_model

from electricity.models import (
    Breaker,
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    ResidualCurrentDevice,
    UsagePoint,
)
from households.models import Household, HouseholdMember


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


class ElectricityBoardFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ElectricityBoard

    household = factory.SubFactory(HouseholdFactory)
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")
    name = factory.Sequence(lambda n: f"Tableau {n}")
    supply_type = "single_phase"


class ResidualCurrentDeviceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ResidualCurrentDevice

    household = factory.SelfAttribute("board.household")
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")
    board = factory.SubFactory(ElectricityBoardFactory)
    label = factory.Sequence(lambda n: f"RCD-{n}")
    rating_amps = 40
    sensitivity_ma = 30
    type_code = "a"


class BreakerFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Breaker

    household = factory.SelfAttribute("board.household")
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")
    board = factory.SubFactory(ElectricityBoardFactory)
    label = factory.Sequence(lambda n: f"BRK-{n}")
    rating_amps = 20
    curve_type = "c"


class ElectricCircuitFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ElectricCircuit

    household = factory.SelfAttribute("board.household")
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")
    board = factory.SubFactory(ElectricityBoardFactory)
    breaker = factory.SubFactory(BreakerFactory, board=factory.SelfAttribute("..board"))
    label = factory.Sequence(lambda n: f"CIR-{n}")
    name = factory.Sequence(lambda n: f"Circuit {n}")
    phase = None
    is_active = True


class UsagePointFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = UsagePoint

    household = factory.SubFactory(HouseholdFactory)
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")
    label = factory.Sequence(lambda n: f"UP-{n}")
    name = factory.Sequence(lambda n: f"Point {n}")
    kind = "socket"


class CircuitUsagePointLinkFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CircuitUsagePointLink

    household = factory.SelfAttribute("circuit.household")
    created_by = factory.SubFactory(UserFactory)
    updated_by = factory.SelfAttribute("created_by")
    circuit = factory.SubFactory(ElectricCircuitFactory)
    usage_point = factory.SubFactory(UsagePointFactory, household=factory.SelfAttribute("..circuit.household"))
    is_active = True
