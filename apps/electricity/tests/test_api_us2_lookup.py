# electricity/tests/test_api_us2_lookup.py
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
def test_lookup_by_breaker_returns_circuits_and_usage_points_for_member_read():
    owner = UserFactory()
    member = UserFactory()
    board = ElectricityBoardFactory(
        created_by=owner,
        updated_by=owner,
        name="Tableau A",
        supply_type="three_phase",
    )
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)
    HouseholdMemberFactory(household=household, user=member, role=HouseholdMember.Role.MEMBER)

    breaker = BreakerFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        label="BRK-01",
        rating_amps=20,
        curve_type="c",
    )
    circuit = ElectricCircuitFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        breaker=breaker,
        label="CIR-01",
        name="Cuisine prises",
        phase="L1",
        is_active=True,
    )
    usage_point = UsagePointFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        label="UP-01",
        name="Plan de travail",
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
    client.force_authenticate(user=member)

    response = client.get(
        "/api/electricity/mapping/lookup/",
        {"ref": "BRK-01", "household_id": str(household.id)},
        format="json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["kind"] == "breaker"
    assert response.data["breaker"]["label"] == "BRK-01"
    assert len(response.data["circuits"]) == 1
    assert response.data["circuits"][0]["label"] == "CIR-01"
    assert len(response.data["usage_points"]) == 1
    assert response.data["usage_points"][0]["label"] == "UP-01"
