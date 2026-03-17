import pytest
from rest_framework import status
from rest_framework.test import APIClient

from households.models import HouseholdMember

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory


@pytest.mark.django_db
def test_each_household_can_have_its_own_active_board():
    owner = UserFactory()
    household_a = HouseholdFactory(name="Maison A bis")
    household_b = HouseholdFactory(name="Maison B bis")
    HouseholdMemberFactory(household=household_a, user=owner, role=HouseholdMember.Role.OWNER)
    HouseholdMemberFactory(household=household_b, user=owner, role=HouseholdMember.Role.OWNER)

    client = APIClient()
    client.force_authenticate(user=owner)

    owner.active_household = household_a
    owner.save(update_fields=["active_household"])
    response_a = client.post(
        "/api/electricity/boards/",
        {"name": "Board A", "supply_type": "single_phase"},
        format="json",
    )
    owner.active_household = household_b
    owner.save(update_fields=["active_household"])
    response_b = client.post(
        "/api/electricity/boards/",
        {"name": "Board B", "supply_type": "three_phase"},
        format="json",
    )

    assert response_a.status_code == status.HTTP_201_CREATED
    assert response_b.status_code == status.HTTP_201_CREATED
    assert response_a.data["household"] != response_b.data["household"]