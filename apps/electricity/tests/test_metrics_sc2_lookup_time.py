# electricity/tests/test_metrics_sc2_lookup_time.py
import time

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
def test_sc2_lookup_bidirectional_under_10_seconds():
    owner = UserFactory()
    board = ElectricityBoardFactory(created_by=owner, updated_by=owner, name="Tableau M2", supply_type="single_phase")
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)

    breaker = BreakerFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        label="BRK-M2",
        rating_amps=20,
        curve_type="c",
    )
    circuit = ElectricCircuitFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        breaker=breaker,
        label="CIR-M2",
        name="Circuit M2",
        is_active=True,
    )
    usage_point = UsagePointFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        label="UP-M2",
        name="Point M2",
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

    started = time.monotonic()
    for ref in ("BRK-M2", "UP-M2") * 10:
        response = client.get(
            "/api/electricity/mapping/lookup/",
            {"ref": ref, "household_id": str(household.id)},
        )
        assert response.status_code == status.HTTP_200_OK
    elapsed = time.monotonic() - started

    assert elapsed < 10.0
