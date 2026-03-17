from datetime import date

import pytest
from django.urls import reverse

from accounts.models import User
from equipment.models import Equipment, EquipmentInteraction
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="equipment-extra@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Equipment extra home")


@pytest.fixture
def second_household(db):
    return Household.objects.create(name="Equipment extra other home")


@pytest.fixture
def dual_membership(user, household, second_household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)
    HouseholdMember.objects.create(user=user, household=second_household, role=HouseholdMember.Role.MEMBER)


@pytest.mark.django_db
def test_equipment_create_rejects_zone_from_other_household(client, user, household, second_household, dual_membership):
    foreign_zone = Zone.objects.create(household=second_household, name="Garage", created_by=user)

    client.force_login(user)
    response = client.post(
        reverse("equipment-list"),
        data={"name": "Boiler", "status": "active", "zone": str(foreign_zone.id)},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "zone" in response.json()


@pytest.mark.django_db
def test_equipment_serializer_returns_next_service_due(client, user, household, dual_membership):
    equipment = Equipment.objects.create(
        household=household,
        name="Boiler",
        status="active",
        maintenance_interval_months=3,
        last_service_at=date(2026, 1, 31),
        created_by=user,
    )

    client.force_login(user)
    response = client.get(reverse("equipment-detail", kwargs={"pk": equipment.id}),)

    assert response.status_code == 200
    assert response.json()["next_service_due"] == "2026-04-30"


@pytest.mark.django_db
def test_equipment_interaction_create_rejects_inaccessible_equipment(client, user, household, second_household, dual_membership):
    foreign_equipment = Equipment.objects.create(household=second_household, name="Freezer", status="active", created_by=user)
    own_interaction = Interaction.objects.create(
        household=household,
        subject="Maintenance",
        type="maintenance",
        occurred_at="2026-03-07T10:00:00Z",
        created_by=user,
    )
    own_zone = Zone.objects.create(household=household, name="Kitchen", created_by=user)
    own_interaction.zones.add(own_zone)

    client.force_login(user)
    response = client.post(
        reverse("equipment-interaction-list"),
        data={"equipment": str(foreign_equipment.id), "interaction": str(own_interaction.id), "role": "maintenance", "note": "x"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert not EquipmentInteraction.objects.filter(equipment=foreign_equipment, interaction=own_interaction).exists()
