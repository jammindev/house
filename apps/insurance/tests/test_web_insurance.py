import pytest
from django.urls import reverse

from accounts.models import User
from households.models import Household, HouseholdMember
from insurance.models import InsuranceContract


@pytest.fixture
def user(db):
    return User.objects.create_user(email="insurance-web@test.dev", password="secret")


@pytest.fixture
def household(db):
    return Household.objects.create(name="Home")


@pytest.fixture
def membership(user, household):
    return HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)


@pytest.fixture
def contract(household, user):
    return InsuranceContract.objects.create(
        household=household,
        name="Home policy",
        provider="Allianz",
        created_by=user,
    )


@pytest.mark.django_db
def test_insurance_list_page_renders(client, user, household, membership):
    client.force_login(user)
    response = client.get(reverse("app_insurance"), HTTP_X_HOUSEHOLD_ID=str(household.id))

    assert response.status_code == 200
    assert "insurance/app/insurance.html" in [template.name for template in response.templates]
    assert "contracts" in response.context


@pytest.mark.django_db
def test_insurance_new_page_creates_contract(client, user, household, membership):
    client.force_login(user)
    response = client.post(
        reverse("app_insurance_new"),
        data={
            "name": "Car policy",
            "type": InsuranceContract.InsuranceType.CAR,
            "status": InsuranceContract.InsuranceStatus.ACTIVE,
            "payment_frequency": InsuranceContract.PaymentFrequency.YEARLY,
            "monthly_cost": "0",
            "yearly_cost": "540",
        },
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 302
    assert InsuranceContract.objects.filter(name="Car policy", household=household).exists()


@pytest.mark.django_db
def test_insurance_detail_and_edit_pages_render(client, user, household, membership, contract):
    client.force_login(user)

    detail_response = client.get(
        reverse("app_insurance_detail", kwargs={"contract_id": contract.id}),
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )
    assert detail_response.status_code == 200
    assert "insurance/app/insurance_detail.html" in [template.name for template in detail_response.templates]

    edit_response = client.get(
        reverse("app_insurance_edit", kwargs={"contract_id": contract.id}),
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )
    assert edit_response.status_code == 200
    assert "insurance/app/insurance_edit.html" in [template.name for template in edit_response.templates]


@pytest.mark.django_db
def test_insurance_delete_view_removes_contract(client, user, household, membership, contract):
    client.force_login(user)
    response = client.post(
        reverse("app_insurance_delete", kwargs={"contract_id": contract.id}),
        HTTP_X_HOUSEHOLD_ID=str(household.id),
    )

    assert response.status_code == 302
    assert not InsuranceContract.objects.filter(id=contract.id).exists()
