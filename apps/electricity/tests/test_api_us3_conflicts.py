# electricity/tests/test_api_us3_conflicts.py
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from households.models import HouseholdMember

from .factories import (
    BreakerFactory,
    CircuitUsagePointLinkFactory,
    ElectricCircuitFactory,
    ElectricityBoardFactory,
    HouseholdMemberFactory,
    UserFactory,
    UsagePointFactory,
)


@pytest.mark.django_db
def test_delete_circuit_with_active_link_returns_conflict():
    owner = UserFactory()
    board = ElectricityBoardFactory(created_by=owner, updated_by=owner, name="Tableau C", supply_type="single_phase")
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)

    breaker = BreakerFactory(household=household, created_by=owner, updated_by=owner, board=board, label="BRK-C")
    circuit = ElectricCircuitFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        breaker=breaker,
        label="CIR-C",
        name="Circuit C",
    )
    usage_point = UsagePointFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        label="UP-C",
        name="Point C",
        kind="socket",
    )
    CircuitUsagePointLinkFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        circuit=circuit,
        usage_point=usage_point,
        is_active=True,
    )

    client = APIClient()
    client.force_authenticate(user=owner)

    response = client.delete(
        f"/api/electricity/circuits/{circuit.id}/",
        format="json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == status.HTTP_409_CONFLICT


@pytest.mark.django_db
def test_delete_breaker_with_active_circuits_returns_conflict():
    owner = UserFactory()
    board = ElectricityBoardFactory(created_by=owner, updated_by=owner, name="Tableau CB", supply_type="single_phase")
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)

    breaker = BreakerFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        label="BRK-CB",
        rating_amps=16,
        curve_type="c",
    )
    ElectricCircuitFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        breaker=breaker,
        label="CIR-CB",
        name="Circuit CB",
        is_active=True,
    )

    client = APIClient()
    client.force_authenticate(user=owner)

    response = client.delete(
        f"/api/electricity/breakers/{breaker.id}/",
        format="json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == status.HTTP_409_CONFLICT
