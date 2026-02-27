# electricity/tests/test_metrics_sc3_access_control.py
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from households.models import HouseholdMember

from .factories import ElectricityBoardFactory, HouseholdMemberFactory, UserFactory


@pytest.mark.django_db
def test_sc3_non_member_cannot_read_or_write_foreign_household():
    owner = UserFactory()
    outsider = UserFactory()

    board = ElectricityBoardFactory(created_by=owner, updated_by=owner, name="Tableau M3", supply_type="single_phase")
    household = board.household
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)

    client = APIClient()
    client.force_authenticate(user=outsider)

    list_response = client.get(
        "/api/electricity/boards/",
        {"household_id": str(household.id)},
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )
    create_response = client.post(
        "/api/electricity/boards/",
        {"name": "Hack", "supply_type": "single_phase"},
        format="json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )
    detail_response = client.get(
        f"/api/electricity/boards/{board.id}/",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert list_response.status_code in {
        status.HTTP_200_OK,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    }
    if list_response.status_code == status.HTTP_200_OK:
        if isinstance(list_response.data, list):
            assert len(list_response.data) == 0
        else:
            assert list_response.data["count"] == 0
    assert detail_response.status_code in {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}
    assert create_response.status_code == status.HTTP_403_FORBIDDEN
