import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document
from households.models import Household, HouseholdMember
from zones.models import Zone, ZoneDocument


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
    return UserFactory(email="zones-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _household("Zones House")
    _membership(owner, instance)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.mark.django_db
class TestZonesExtraApi:
    def test_tree_requires_household_query_parameter(self, owner_client):
        url = reverse("zone-tree")
        response = owner_client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_tree_returns_nested_children(self, owner_client, household, owner):
        parent = Zone.objects.create(household=household, name="Home", created_by=owner)
        child = Zone.objects.create(household=household, name="Living room", parent=parent, created_by=owner)

        url = reverse("zone-tree")
        response = owner_client.get(url, {"household_id": str(household.id)})

        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["id"] == str(parent.id)
        assert response.data[0]["children"][0]["id"] == str(child.id)

    def test_children_returns_direct_children(self, owner_client, household, owner):
        parent = Zone.objects.create(household=household, name="Ground floor", created_by=owner)
        child = Zone.objects.create(household=household, name="Kitchen", parent=parent, created_by=owner)

        url = reverse("zone-children", kwargs={"pk": parent.id})
        response = owner_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert [item["id"] for item in response.data] == [str(child.id)]

    def test_create_rejects_parent_from_other_household(self, owner_client, owner, household):
        other_household = _household("Other Zones House")
        _membership(owner, other_household)
        foreign_parent = Zone.objects.create(household=other_household, name="Foreign parent", created_by=owner)

        url = reverse("zone-list")
        response = owner_client.post(
            url,
            {"name": "Should fail", "parent": str(foreign_parent.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "parent" in response.data

    def test_attach_photo_links_document_in_same_household(self, owner_client, owner, household):
        zone = Zone.objects.create(household=household, name="Bathroom", created_by=owner)
        document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path="zones/bathroom.jpg",
            name="Bathroom photo",
            mime_type="image/jpeg",
            type="photo",
        )

        url = reverse("zone-attach-photo", kwargs={"pk": zone.id})
        response = owner_client.post(
            url,
            {"document_id": str(document.id), "note": "Reference photo"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert ZoneDocument.objects.filter(zone=zone, document=document, note="Reference photo").exists()

    def test_attach_photo_rejects_document_from_other_household(self, owner_client, owner, household):
        zone = Zone.objects.create(household=household, name="Office", created_by=owner)
        other_household = _household("Other Documents House")
        _membership(owner, other_household)
        foreign_document = Document.objects.create(
            household=other_household,
            created_by=owner,
            file_path="zones/foreign.jpg",
            name="Foreign photo",
            mime_type="image/jpeg",
            type="photo",
        )

        url = reverse("zone-attach-photo", kwargs={"pk": zone.id})
        response = owner_client.post(
            url,
            {"document_id": str(foreign_document.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_photos_returns_zone_documents(self, owner_client, owner, household):
        zone = Zone.objects.create(household=household, name="Entrance", created_by=owner)
        document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path="zones/entrance.jpg",
            name="Entrance photo",
            mime_type="image/jpeg",
            type="photo",
        )
        ZoneDocument.objects.create(zone=zone, document=document, role="photo", created_by=owner)

        url = reverse("zone-photos", kwargs={"pk": zone.id})
        response = owner_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["document_name"] == "Entrance photo"