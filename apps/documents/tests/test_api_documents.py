import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone


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
    return UserFactory(email="documents-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _household("Documents House")
    _membership(owner, instance)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


def _interaction(household, owner):
    zone = Zone.objects.create(household=household, name="Kitchen", created_by=owner)
    interaction = Interaction.objects.create(
        household=household,
        created_by=owner,
        subject="Invoice",
        type="expense",
        occurred_at="2026-03-07T10:00:00Z",
    )
    interaction.zones.add(zone)
    return interaction


@pytest.mark.django_db
class TestDocumentsApi:
    def test_create_document_uses_selected_household(self, owner_client, household):
        url = reverse("document-list")
        response = owner_client.post(
            url,
            {"file_path": "docs/invoice.pdf", "name": "Invoice", "mime_type": "application/pdf", "type": "invoice"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert Document.objects.filter(id=response.data["id"], household=household).exists()

    def test_create_document_with_interaction_infers_household(self, owner_client, owner, household):
        interaction = _interaction(household, owner)
        url = reverse("document-list")
        response = owner_client.post(
            url,
            {"file_path": "docs/manual.pdf", "name": "Manual", "mime_type": "application/pdf", "type": "manual", "interaction": str(interaction.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        document = Document.objects.get(id=response.data["id"])
        assert document.household == household
        assert document.interaction == interaction

    def test_reject_document_when_selected_household_mismatches_interaction(self, owner_client, owner, household):
        interaction = _interaction(household, owner)
        other_household = _household("Other Docs House")
        _membership(owner, other_household)

        url = reverse("document-list")
        response = owner_client.post(
            url,
            {"file_path": "docs/bad.pdf", "name": "Bad", "mime_type": "application/pdf", "type": "document", "interaction": str(interaction.id)},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(other_household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "household_id" in response.data

    def test_by_type_groups_documents(self, owner_client, owner, household):
        Document.objects.create(household=household, created_by=owner, file_path="docs/a.pdf", name="A", mime_type="application/pdf", type="document")
        Document.objects.create(household=household, created_by=owner, file_path="docs/b.jpg", name="B", mime_type="image/jpeg", type="photo")

        url = reverse("document-by-type")
        response = owner_client.get(url, HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["document"]["count"] == 1
        assert response.data["photo"]["count"] == 1

    def test_reprocess_ocr_returns_accepted(self, owner_client, owner, household):
        document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path="docs/reprocess.pdf",
            name="OCR",
            mime_type="application/pdf",
            type="document",
        )

        url = reverse("document-reprocess-ocr", kwargs={"pk": document.id})
        response = owner_client.post(url, {}, format="json", HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_202_ACCEPTED