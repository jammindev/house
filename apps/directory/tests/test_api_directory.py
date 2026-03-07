import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from directory.models import Address, Contact, Email, Phone, Structure
from households.models import Household, HouseholdMember


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _household(name: str) -> Household:
    return Household.objects.create(name=name)


def _membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


@pytest.fixture
def owner(db):
    return UserFactory(email="directory-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _household("Directory House")
    _membership(owner, instance)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.mark.django_db
class TestDirectoryApi:
    def test_create_structure_uses_selected_household(self, owner_client, household):
        url = reverse("structure-list")
        response = owner_client.post(
            url,
            {"name": "Plumber Inc", "type": "contractor", "website": "https://example.com", "tags": ["plumbing"]},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert Structure.objects.filter(id=response.data["id"], household=household).exists()

    def test_create_contact_rejects_foreign_structure(self, owner_client, owner, household):
        other_household = _household("Foreign Structure House")
        _membership(owner, other_household)
        foreign_structure = Structure.objects.create(household=other_household, created_by=owner, name="Hidden company")

        url = reverse("contact-list")
        response = owner_client.post(
            url,
            {"structure": str(foreign_structure.id), "first_name": "Jane", "last_name": "Doe"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "structure" in response.data

    def test_create_contact_and_nested_list(self, owner_client, owner, household):
        structure = Structure.objects.create(household=household, created_by=owner, name="Electric Co")
        contact_response = owner_client.post(
            reverse("contact-list"),
            {"structure": str(structure.id), "first_name": "Anna", "last_name": "Smith", "position": "Manager"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )
        contact = Contact.objects.get(id=contact_response.data["id"])
        Email.objects.create(household=household, created_by=owner, contact=contact, email="anna@example.com", is_primary=True)
        Phone.objects.create(household=household, created_by=owner, contact=contact, phone="12345", is_primary=True)
        Address.objects.create(household=household, created_by=owner, contact=contact, address_1="1 Main St", city="Paris", is_primary=True)

        response = owner_client.get(reverse("contact-list"), HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_200_OK
        entry = response.data[0]
        assert entry["structure"]["id"] == str(structure.id)
        assert entry["emails"][0]["email"] == "anna@example.com"
        assert entry["phones"][0]["phone"] == "12345"
        assert entry["addresses"][0]["address_1"] == "1 Main St"

    def test_create_address_rejects_foreign_contact(self, owner_client, owner, household):
        other_household = _household("Foreign Contact House")
        _membership(owner, other_household)
        foreign_contact = Contact.objects.create(household=other_household, created_by=owner, first_name="John", last_name="Foreign")

        url = reverse("address-list")
        response = owner_client.post(
            url,
            {"contact": str(foreign_contact.id), "address_1": "2 Elsewhere", "city": "Lyon"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "contact" in response.data