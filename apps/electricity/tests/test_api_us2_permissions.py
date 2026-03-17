# electricity/tests/test_api_us2_permissions.py
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from households.models import HouseholdMember

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory


@pytest.mark.django_db
def test_member_can_read_boards_list():
    member = UserFactory()
    household = HouseholdFactory(name="Maison Permissions")
    HouseholdMemberFactory(household=household, user=member, role=HouseholdMember.Role.MEMBER)

    client = APIClient()
    client.force_authenticate(user=member)

    response = client.get("/api/electricity/boards/")

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_member_cannot_create_breaker():
    owner = UserFactory()
    member = UserFactory()

    household = HouseholdFactory(name="Maison Permissions B")
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)
    HouseholdMemberFactory(household=household, user=member, role=HouseholdMember.Role.MEMBER)

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)
    board_response = owner_client.post(
        "/api/electricity/boards/",
        {"name": "Tableau P", "supply_type": "single_phase"},
        format="json",
    )

    assert board_response.status_code == status.HTTP_201_CREATED

    member_client = APIClient()
    member_client.force_authenticate(user=member)
    response = member_client.post(
        "/api/electricity/breakers/",
        {
            "board": board_response.data["id"],
            "label": "BRK-P1",
            "rating_amps": 16,
            "curve_type": "c",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
