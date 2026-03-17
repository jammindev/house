# electricity/tests/test_api_us1_creation.py
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from households.models import HouseholdMember

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory


@pytest.mark.django_db
def test_owner_can_create_board():
    owner = UserFactory()
    household = HouseholdFactory(name="Maison A")
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)

    client = APIClient()
    client.force_authenticate(user=owner)

    response = client.post(
        "/api/electricity/boards/",
        {"name": "Tableau principal", "supply_type": "three_phase"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert str(response.data["household"]) == str(household.id)
    assert response.data["supply_type"] == "three_phase"


@pytest.mark.django_db
def test_member_cannot_create_board():
    member = UserFactory()
    household = HouseholdFactory(name="Maison B")
    HouseholdMemberFactory(household=household, user=member, role=HouseholdMember.Role.MEMBER)

    client = APIClient()
    client.force_authenticate(user=member)

    response = client.post(
        "/api/electricity/boards/",
        {"name": "Tableau secondaire", "supply_type": "single_phase"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_owner_cannot_create_second_active_board():
    owner = UserFactory()
    household = HouseholdFactory(name="Maison C")
    HouseholdMemberFactory(household=household, user=owner, role=HouseholdMember.Role.OWNER)

    client = APIClient()
    client.force_authenticate(user=owner)

    first_response = client.post(
        "/api/electricity/boards/",
        {"name": "Tableau principal", "supply_type": "single_phase"},
        format="json",
    )
    assert first_response.status_code == status.HTTP_201_CREATED

    second_response = client.post(
        "/api/electricity/boards/",
        {"name": "Tableau secondaire", "supply_type": "three_phase"},
        format="json",
    )

    assert second_response.status_code == status.HTTP_400_BAD_REQUEST
