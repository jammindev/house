import pytest
from django.urls import reverse
from django.utils import timezone

from accounts.models import User
from equipment.models import Equipment
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone


@pytest.fixture
def user(db):
    return User.objects.create_user(email="equipment@test.dev", password="secret")


@pytest.fixture
def second_user(db):
    return User.objects.create_user(email="other@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Main home")


@pytest.fixture
def second_household(db):
    return Household.objects.create(name="Second home")


@pytest.fixture
def membership(user, household):
    return HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.fixture
def dual_membership(user, household, second_household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)
    HouseholdMember.objects.create(user=user, household=second_household, role=HouseholdMember.Role.MEMBER)


@pytest.fixture
def zone(household, user):
    return Zone.objects.create(household=household, name="Kitchen", created_by=user)


@pytest.mark.django_db
def test_equipment_list_filters_by_selected_household_and_status(client, user, household, second_household, dual_membership):
    Equipment.objects.create(household=household, name="Dishwasher", status="active", created_by=user)
    Equipment.objects.create(household=household, name="Boiler", status="maintenance", created_by=user)
    Equipment.objects.create(household=second_household, name="Aircon", status="active", created_by=user)

    client.force_login(user)
    response = client.get(
        reverse("equipment-list"),
        {"status": "active"},
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 200
    payload = response.json()
    names = [entry["name"] for entry in payload]
    assert names == ["Dishwasher"]


@pytest.mark.django_db
def test_equipment_audit_action_returns_created_and_updated_user(client, user, second_user, household, membership):
    equipment = Equipment.objects.create(
        household=household,
        name="Washing machine",
        status="active",
        created_by=user,
        updated_by=second_user,
    )

    client.force_login(user)
    response = client.get(reverse("equipment-audit", kwargs={"pk": equipment.id}), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert response.status_code == 200
    payload = response.json()
    assert payload["created_by"]["id"] == str(user.id)
    assert payload["updated_by"]["id"] == str(second_user.id)


@pytest.mark.django_db
def test_equipment_update_rejects_zone_from_other_household(client, user, household, second_household, dual_membership):
    own_zone = Zone.objects.create(household=household, name="Kitchen", created_by=user)
    foreign_zone = Zone.objects.create(household=second_household, name="Garage", created_by=user)
    equipment = Equipment.objects.create(
        household=household,
        zone=own_zone,
        name="Boiler",
        status="active",
        created_by=user,
    )

    client.force_login(user)
    response = client.patch(
        reverse("equipment-detail", kwargs={"pk": equipment.id}),
        data={"zone": str(foreign_zone.id)},
        content_type="application/json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 400
    payload = response.json()
    assert "zone" in payload


@pytest.mark.django_db
def test_equipment_interaction_create_rejects_cross_household_interaction(
    client,
    user,
    household,
    second_household,
    dual_membership,
):
    equipment = Equipment.objects.create(household=household, name="Dryer", status="active", created_by=user)
    interaction = Interaction.objects.create(
        household=second_household,
        subject="Other household event",
        content="",
        type="maintenance",
        occurred_at=timezone.now(),
        created_by=user,
    )

    client.force_login(user)
    response = client.post(
        reverse("equipment-interaction-list"),
        data={"equipment": str(equipment.id), "interaction": str(interaction.id), "role": "maintenance", "note": "x"},
        content_type="application/json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["interaction"] == "Interaction household must match equipment household."
