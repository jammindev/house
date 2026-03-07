import pytest
from django.urls import reverse

from accounts.models import User
from households.models import Household, HouseholdMember
from insurance.models import InsuranceContract


@pytest.fixture
def user(db):
    return User.objects.create_user(email="insurance-extra@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Insurance extra home")


@pytest.fixture
def dual_membership(user, household):
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.mark.django_db
def test_insurance_create_rejects_end_date_before_start_date(client, user, household, dual_membership):
    client.force_login(user)
    response = client.post(
        reverse("insurance-contract-list"),
        data={
            "name": "Broken policy",
            "start_date": "2026-03-10",
            "end_date": "2026-03-01",
        },
        content_type="application/json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 400
    assert "end_date" in response.json()


@pytest.mark.django_db
def test_insurance_update_sets_updated_by(client, user, household, dual_membership):
    contract = InsuranceContract.objects.create(
        household=household,
        name="Home policy",
        type=InsuranceContract.InsuranceType.HOME,
        created_by=user,
    )

    client.force_login(user)
    response = client.patch(
        reverse("insurance-contract-detail", kwargs={"pk": contract.id}),
        data={"name": "Updated home policy"},
        content_type="application/json",
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 200
    contract.refresh_from_db()
    assert contract.updated_by == user
