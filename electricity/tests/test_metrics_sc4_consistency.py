# electricity/tests/test_metrics_sc4_consistency.py
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from electricity.models import CircuitUsagePointLink
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
def test_sc4_consistency_rules_suite():
    owner = UserFactory()
    board = ElectricityBoardFactory(created_by=owner, updated_by=owner, name="Tableau M4", supply_type="single_phase")
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)

    breaker = BreakerFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        label="REF-100",
        rating_amps=20,
        curve_type="c",
    )
    circuit = ElectricCircuitFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        breaker=breaker,
        label="CIR-M4",
        name="Circuit M4",
        is_active=True,
    )
    usage_point = UsagePointFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        label="UP-M4",
        name="Point M4",
        kind="socket",
    )

    link_1 = CircuitUsagePointLinkFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        circuit=circuit,
        usage_point=usage_point,
        is_active=True,
    )

    client = APIClient()
    client.force_authenticate(user=owner)

    duplicate_label_response = client.post(
        "/api/electricity/circuits/",
        {
            "board": str(board.id),
            "breaker": str(breaker.id),
            "label": "REF-100",
            "name": "Circuit duplicate label",
            "is_active": True,
        },
        format="json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    second_link_response = client.post(
        "/api/electricity/links/",
        {
            "circuit": str(circuit.id),
            "usage_point": str(usage_point.id),
            "is_active": True,
        },
        format="json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    delete_circuit_response = client.delete(
        f"/api/electricity/circuits/{circuit.id}/",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    checks = [
        duplicate_label_response.status_code == status.HTTP_400_BAD_REQUEST,
        second_link_response.status_code == status.HTTP_400_BAD_REQUEST,
        delete_circuit_response.status_code == status.HTTP_409_CONFLICT,
        CircuitUsagePointLink.objects.filter(id=link_1.id, is_active=True).exists(),
    ]

    passed_ratio = sum(1 for check in checks if check) / len(checks)
    assert passed_ratio >= 0.9
