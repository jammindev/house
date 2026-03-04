import pytest
from django.urls import reverse

from accounts.models import User
from households.models import Household, HouseholdMember
from insurance.models import InsuranceContract


@pytest.fixture
def user(db):
    return User.objects.create_user(email="insurance@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Main home")


@pytest.fixture
def second_household(db):
    return Household.objects.create(name="Second home")


@pytest.fixture
def dual_membership(user, household, second_household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)
    HouseholdMember.objects.create(user=user, household=second_household, role=HouseholdMember.Role.MEMBER)


@pytest.mark.django_db
def test_insurance_list_filters_by_household(client, user, household, second_household, dual_membership):
    InsuranceContract.objects.create(
        household=household,
        name="Home policy",
        type=InsuranceContract.InsuranceType.HOME,
        created_by=user,
    )
    InsuranceContract.objects.create(
        household=second_household,
        name="Car policy",
        type=InsuranceContract.InsuranceType.CAR,
        created_by=user,
    )

    client.force_login(user)
    response = client.get(reverse("insurance-contract-list"), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert response.status_code == 200
    payload = response.json()
    names = [entry["name"] for entry in payload]
    assert names == ["Home policy"]


@pytest.mark.django_db
def test_insurance_create_contract(client, user, household, dual_membership):
    client.force_login(user)
    response = client.post(
        reverse("insurance-contract-list"),
        data={
            "name": "Liability policy",
            "type": InsuranceContract.InsuranceType.LIABILITY,
            "status": InsuranceContract.InsuranceStatus.ACTIVE,
            "payment_frequency": InsuranceContract.PaymentFrequency.MONTHLY,
            "monthly_cost": "21.99",
            "yearly_cost": "263.88",
        },
        content_type="application/json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 201
    created = InsuranceContract.objects.get(name="Liability policy")
    assert created.household_id == household.id
    assert str(created.monthly_cost) == "21.99"


@pytest.mark.django_db
def test_insurance_create_rejects_negative_cost(client, user, household, dual_membership):
    client.force_login(user)
    response = client.post(
        reverse("insurance-contract-list"),
        data={
            "name": "Invalid policy",
            "monthly_cost": "-1",
            "yearly_cost": "120",
        },
        content_type="application/json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 400
    payload = response.json()
    assert "monthly_cost" in payload
