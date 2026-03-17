import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from projects.models import Project, ProjectDocument
from zones.models import Zone
from zones.models import ZoneDocument


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
    @override_settings(MEDIA_ROOT='/tmp/house-test-media')
    def test_upload_document_multipart_returns_detail_url_and_without_activity(self, owner_client, household):
        url = reverse('document-upload')
        upload = SimpleUploadedFile('invoice.pdf', b'%PDF-1.4 test', content_type='application/pdf')

        response = owner_client.post(
            url,
            {'file': upload, 'name': 'Invoice March', 'type': 'invoice'},
            format='multipart',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['detail_url'].endswith(f"/app/documents/{response.data['document']['id']}/")
        assert response.data['document']['qualification']['qualification_state'] == 'without_activity'
        assert response.data['document']['metadata']['size'] == len(b'%PDF-1.4 test')

    def test_create_document_uses_selected_household(self, owner_client, household):
        url = reverse("document-list")
        response = owner_client.post(
            url,
            {"file_path": "docs/invoice.pdf", "name": "Invoice", "mime_type": "application/pdf", "type": "invoice"},
            format="json",
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

        owner.active_household = other_household
        owner.save(update_fields=["active_household"])

        url = reverse("document-list")
        response = owner_client.post(
            url,
            {"file_path": "docs/bad.pdf", "name": "Bad", "mime_type": "application/pdf", "type": "document", "interaction": str(interaction.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "household_id" in response.data

    def test_by_type_groups_documents(self, owner_client, owner, household):
        Document.objects.create(household=household, created_by=owner, file_path="docs/a.pdf", name="A", mime_type="application/pdf", type="document")
        Document.objects.create(household=household, created_by=owner, file_path="docs/b.jpg", name="B", mime_type="image/jpeg", type="photo")

        url = reverse("document-by-type")
        response = owner_client.get(url)

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
        response = owner_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_202_ACCEPTED

    def test_upload_requires_household_context(self, owner_client):
        url = reverse('document-upload')
        upload = SimpleUploadedFile('invoice.pdf', b'%PDF-1.4 test', content_type='application/pdf')

        response = owner_client.post(url, {'file': upload}, format='multipart')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'household_id' in response.data

    def test_list_exposes_qualification_flags_from_interaction_documents(self, owner_client, owner, household):
        linked_document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path='docs/linked.pdf',
            name='Linked',
            mime_type='application/pdf',
            type='document',
        )
        unlinked_document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path='docs/unlinked.pdf',
            name='Unlinked',
            mime_type='application/pdf',
            type='document',
        )
        interaction = _interaction(household, owner)
        interaction.interaction_documents.create(document=linked_document)

        url = reverse('document-list')
        response = owner_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        payload_by_name = {item['name']: item for item in response.data}
        assert payload_by_name['Linked']['qualification']['qualification_state'] == 'activity_linked'
        assert payload_by_name['Linked']['qualification']['linked_interactions_count'] == 1
        assert payload_by_name['Unlinked']['qualification']['qualification_state'] == 'without_activity'
        assert payload_by_name['Unlinked']['linked_interactions'] == []

    def test_detail_exposes_linked_interactions_secondary_contexts_and_recent_candidates(self, owner_client, owner, household):
        zone = Zone.objects.create(household=household, name='Boiler room', created_by=owner)
        document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path='docs/manual.pdf',
            name='Boiler manual',
            mime_type='application/pdf',
            type='manual',
            notes='Keep near the boiler.',
            ocr_text='Boiler maintenance instructions',
        )
        linked_interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject='Annual boiler maintenance',
            type='maintenance',
            occurred_at='2026-03-07T10:00:00Z',
        )
        linked_interaction.zones.add(zone)
        recent_interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject='Heating inspection',
            type='inspection',
            occurred_at='2026-03-08T10:00:00Z',
        )
        recent_interaction.zones.add(zone)
        linked_interaction.interaction_documents.create(document=document)
        ZoneDocument.objects.create(zone=zone, document=document, created_by=owner)
        project = Project.objects.create(
            household=household,
            created_by=owner,
            title='Heating project',
            type=Project.Type.MAINTENANCE,
            status=Project.Status.ACTIVE,
        )
        ProjectDocument.objects.create(project=project, document=document, created_by=owner)

        url = reverse('document-detail', kwargs={'pk': document.id})
        response = owner_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['qualification']['qualification_state'] == 'activity_linked'
        assert response.data['qualification']['has_secondary_context'] is True
        assert response.data['linked_interactions'][0]['subject'] == 'Annual boiler maintenance'
        assert response.data['zone_links'][0]['zone_name'] == 'Boiler room'
        assert response.data['project_links'][0]['project_name'] == 'Heating project'
        assert {item['subject'] for item in response.data['recent_interaction_candidates']} == {
            'Heating inspection',
        }