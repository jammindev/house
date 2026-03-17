# electricity/tests/test_api_us3_soft_delete.py
import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from electricity.models import PlanChangeLog
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
def test_owner_can_deactivate_link_and_track_actor_date():
    owner = UserFactory()
    board = ElectricityBoardFactory(created_by=owner, updated_by=owner, name="Tableau US3", supply_type="single_phase")
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)
    breaker = BreakerFactory(household=household, created_by=owner, updated_by=owner, board=board, label="BRK-US3")
    circuit = ElectricCircuitFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        breaker=breaker,
        label="CIR-US3",
        name="Circuit US3",
    )
    usage_point = UsagePointFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        label="UP-US3",
        name="Point US3",
        kind="socket",
    )
    link = CircuitUsagePointLinkFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        circuit=circuit,
        usage_point=usage_point,
        is_active=True,
    )

    client = APIClient()
    client.force_authenticate(user=owner)

    response = client.post(
        f"/api/electricity/links/{link.id}/deactivate/",
        {"household_id": str(household.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    link.refresh_from_db()
    assert link.is_active is False
    assert link.deactivated_by_id == owner.id
    assert link.deactivated_at is not None
    assert link.deactivated_at <= timezone.now()

    assert PlanChangeLog.objects.filter(
        household=household,
        entity_type="link",
        action="deactivate",
        entity_id=link.id,
    ).exists()


@pytest.mark.django_db
def test_member_cannot_deactivate_link():
    owner = UserFactory()
    member = UserFactory()

    board = ElectricityBoardFactory(created_by=owner, updated_by=owner, name="Tableau US3B", supply_type="single_phase")
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)
    HouseholdMemberFactory(household=household, user=member, role=HouseholdMember.Role.MEMBER)

    breaker = BreakerFactory(household=household, created_by=owner, updated_by=owner, board=board, label="BRK-US3B")
    circuit = ElectricCircuitFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        board=board,
        breaker=breaker,
        label="CIR-US3B",
        name="Circuit US3B",
    )
    usage_point = UsagePointFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        label="UP-US3B",
        name="Point US3B",
        kind="socket",
    )
    link = CircuitUsagePointLinkFactory(
        household=household,
        created_by=owner,
        updated_by=owner,
        circuit=circuit,
        usage_point=usage_point,
        is_active=True,
    )

    client = APIClient()
    client.force_authenticate(user=member)

    response = client.post(
        f"/api/electricity/links/{link.id}/deactivate/",
        {"household_id": str(household.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
