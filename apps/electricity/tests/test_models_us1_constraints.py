# electricity/tests/test_models_us1_constraints.py
import pytest
from django.db import IntegrityError

from electricity.models import Breaker, ElectricCircuit
from electricity.serializers import ElectricCircuitSerializer
from households.models import HouseholdMember

from .factories import BreakerFactory, ElectricCircuitFactory, ElectricityBoardFactory, HouseholdMemberFactory, UserFactory


@pytest.mark.django_db
def test_breaker_label_unique_per_household():
    owner = UserFactory()
    board = ElectricityBoardFactory(supply_type="three_phase", created_by=owner, updated_by=owner)
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)

    BreakerFactory(
        household=household,
        board=board,
        label="DJ-1",
        rating_amps=20,
        created_by=owner,
        updated_by=owner,
    )

    with pytest.raises(IntegrityError):
        BreakerFactory(
            household=household,
            board=board,
            label="DJ-1",
            rating_amps=16,
            created_by=owner,
            updated_by=owner,
        )


@pytest.mark.django_db
def test_three_phase_circuit_requires_phase():
    owner = UserFactory()
    board = ElectricityBoardFactory(supply_type="three_phase", created_by=owner, updated_by=owner)
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)
    breaker = BreakerFactory(
        household=household,
        board=board,
        label="DJ-2",
        rating_amps=20,
        created_by=owner,
        updated_by=owner,
    )

    serializer = ElectricCircuitSerializer(
        data={
            "household": str(household.id),
            "board": str(board.id),
            "breaker": str(breaker.id),
            "label": "C1",
            "name": "Circuit cuisine",
            "phase": None,
            "is_active": True,
        }
    )

    assert not serializer.is_valid()
    assert "phase" in serializer.errors


@pytest.mark.django_db
def test_circuit_has_single_breaker_fk():
    owner = UserFactory()
    board = ElectricityBoardFactory(supply_type="single_phase", created_by=owner, updated_by=owner)
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)
    breaker = BreakerFactory(
        household=household,
        board=board,
        label="DJ-3",
        rating_amps=16,
        created_by=owner,
        updated_by=owner,
    )

    circuit = ElectricCircuitFactory(
        household=household,
        board=board,
        breaker=breaker,
        label="C2",
        name="Circuit salon",
        phase=None,
        created_by=owner,
        updated_by=owner,
    )

    assert circuit.breaker_id == breaker.id
