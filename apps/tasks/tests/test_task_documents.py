"""
Tests for Task↔Document and Task↔Interaction links.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from tasks.models import Task, TaskDocument, TaskInteraction
from zones.models import Zone


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_household(name: str) -> Household:
    return Household.objects.create(name=name)


def _add_membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _create_zone(household, user, name: str = "Kitchen") -> Zone:
    return Zone.objects.create(household=household, name=name, created_by=user)


def _create_task(household, user, zone) -> Task:
    from tasks.models import TaskZone
    task = Task.objects.create(
        household=household,
        created_by=user,
        subject="Test task",
    )
    TaskZone.objects.create(task=task, zone=zone)
    return task


def _create_document(household, user, doc_type='document') -> Document:
    return Document.objects.create(
        household=household,
        created_by=user,
        file_path=f'docs/test-{doc_type}.pdf',
        name=f'Test {doc_type}',
        mime_type='application/pdf',
        type=doc_type,
    )


def _create_interaction(household, user, zone) -> Interaction:
    from django.utils import timezone as tz
    from interactions.models import InteractionZone
    interaction = Interaction.objects.create(
        household=household,
        created_by=user,
        subject="Test interaction",
        type="note",
        occurred_at=tz.now(),
    )
    InteractionZone.objects.create(interaction=interaction, zone=zone)
    return interaction


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return UserFactory(email="attachments-owner@example.com")


@pytest.fixture
def other_user(db):
    return UserFactory(email="attachments-other@example.com")


@pytest.fixture
def household(db, owner):
    hh = _create_household("Attachment House")
    _add_membership(owner, hh)
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def other_household(db, other_user):
    hh = _create_household("Other House")
    _add_membership(other_user, hh)
    other_user.active_household = hh
    other_user.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def other_client(other_user):
    return _client_for(other_user)


@pytest.fixture
def zone(household, owner):
    return _create_zone(household, owner)


@pytest.fixture
def task(household, owner, zone):
    return _create_task(household, owner, zone)


@pytest.fixture
def document(household, owner):
    return _create_document(household, owner)


@pytest.fixture
def photo(household, owner):
    return _create_document(household, owner, doc_type='photo')


@pytest.fixture
def interaction(household, owner, zone):
    return _create_interaction(household, owner, zone)


# ── Task Document Link Tests ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestTaskDocumentLinks:
    def test_link_document_to_task(self, owner_client, task, document):
        url = reverse("task-document-list")
        response = owner_client.post(
            url,
            {"task": str(task.id), "document": str(document.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert TaskDocument.objects.filter(task=task, document=document).exists()

    def test_link_photo_to_task(self, owner_client, task, photo):
        url = reverse("task-document-list")
        response = owner_client.post(
            url,
            {"task": str(task.id), "document": str(photo.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_list_task_document_links(self, owner_client, task, document):
        TaskDocument.objects.create(task=task, document=document)
        url = reverse("task-document-list")
        response = owner_client.get(url, {"task": str(task.id)})
        assert response.status_code == status.HTTP_200_OK
        data = response.data if isinstance(response.data, list) else response.data.get("results", [])
        assert len(data) == 1

    def test_delete_document_link(self, owner_client, task, document):
        link = TaskDocument.objects.create(task=task, document=document)
        url = reverse("task-document-detail", args=[link.id])
        response = owner_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not TaskDocument.objects.filter(id=link.id).exists()
        # Document itself should still exist
        assert Document.objects.filter(id=document.id).exists()

    def test_duplicate_link_returns_409(self, owner_client, task, document):
        TaskDocument.objects.create(task=task, document=document)
        url = reverse("task-document-list")
        response = owner_client.post(
            url,
            {"task": str(task.id), "document": str(document.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data.get("code") == "already_linked"

    def test_document_from_other_household_rejected(
        self, owner_client, task, other_household, other_user
    ):
        foreign_doc = Document.objects.create(
            household=other_household,
            created_by=other_user,
            file_path='docs/foreign.pdf',
            name='Foreign',
            mime_type='application/pdf',
            type='document',
        )
        url = reverse("task-document-list")
        response = owner_client.post(
            url,
            {"task": str(task.id), "document": str(foreign_doc.id)},
            format="json",
        )
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        ]

    def test_unauthenticated_user_rejected(self, task, document):
        client = APIClient()
        url = reverse("task-document-list")
        response = client.post(
            url,
            {"task": str(task.id), "document": str(document.id)},
            format="json",
        )
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ]

    def test_task_deletion_cascades_to_links(self, task, document):
        TaskDocument.objects.create(task=task, document=document)
        task_id = task.id
        task.delete()
        assert not TaskDocument.objects.filter(task_id=task_id).exists()
        assert Document.objects.filter(id=document.id).exists()

    def test_task_linked_documents_appear_in_task_serializer(self, owner_client, task, document):
        TaskDocument.objects.create(task=task, document=document)
        url = reverse("task-detail", args=[task.id])
        response = owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["linked_document_count"] == 1
        assert len(response.data["linked_documents"]) == 1
        assert response.data["linked_documents"][0]["name"] == document.name

    def test_create_task_with_document_ids(self, owner_client, household, owner, zone, document):
        url = reverse("task-list")
        response = owner_client.post(
            url,
            {
                "subject": "Task with attachments",
                "zone_ids": [str(zone.id)],
                "document_ids": [str(document.id)],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        task_id = response.data["id"]
        assert TaskDocument.objects.filter(task_id=task_id, document=document).exists()


# ── Task Interaction Link Tests ────────────────────────────────────────────────

@pytest.mark.django_db
class TestTaskInteractionLinks:
    def test_link_interaction_to_task(self, owner_client, task, interaction):
        url = reverse("task-interaction-list")
        response = owner_client.post(
            url,
            {"task": str(task.id), "interaction": str(interaction.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert TaskInteraction.objects.filter(task=task, interaction=interaction).exists()

    def test_list_task_interaction_links(self, owner_client, task, interaction):
        TaskInteraction.objects.create(task=task, interaction=interaction)
        url = reverse("task-interaction-list")
        response = owner_client.get(url, {"task": str(task.id)})
        assert response.status_code == status.HTTP_200_OK
        data = response.data if isinstance(response.data, list) else response.data.get("results", [])
        assert len(data) == 1

    def test_delete_interaction_link(self, owner_client, task, interaction):
        link = TaskInteraction.objects.create(task=task, interaction=interaction)
        url = reverse("task-interaction-detail", args=[link.id])
        response = owner_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not TaskInteraction.objects.filter(id=link.id).exists()
        assert Interaction.objects.filter(id=interaction.id).exists()

    def test_duplicate_interaction_link_returns_409(self, owner_client, task, interaction):
        TaskInteraction.objects.create(task=task, interaction=interaction)
        url = reverse("task-interaction-list")
        response = owner_client.post(
            url,
            {"task": str(task.id), "interaction": str(interaction.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data.get("code") == "already_linked"

    def test_interaction_from_other_household_rejected(
        self, owner_client, task, other_household, other_user
    ):
        other_zone = _create_zone(other_household, other_user, "Other Zone")
        foreign_interaction = _create_interaction(other_household, other_user, other_zone)
        url = reverse("task-interaction-list")
        response = owner_client.post(
            url,
            {"task": str(task.id), "interaction": str(foreign_interaction.id)},
            format="json",
        )
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        ]

    def test_task_deletion_cascades_to_interaction_links(self, task, interaction):
        TaskInteraction.objects.create(task=task, interaction=interaction)
        task_id = task.id
        task.delete()
        assert not TaskInteraction.objects.filter(task_id=task_id).exists()
        assert Interaction.objects.filter(id=interaction.id).exists()

    def test_task_linked_interactions_appear_in_task_serializer(
        self, owner_client, task, interaction
    ):
        TaskInteraction.objects.create(task=task, interaction=interaction)
        url = reverse("task-detail", args=[task.id])
        response = owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["linked_interaction_count"] == 1
        assert len(response.data["linked_interactions"]) == 1
        assert response.data["linked_interactions"][0]["subject"] == interaction.subject

    def test_create_task_with_interaction_ids(self, owner_client, zone, interaction):
        url = reverse("task-list")
        response = owner_client.post(
            url,
            {
                "subject": "Task with interaction",
                "zone_ids": [str(zone.id)],
                "interaction_ids": [str(interaction.id)],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        task_id = response.data["id"]
        assert TaskInteraction.objects.filter(task_id=task_id, interaction=interaction).exists()


# ── Permissions pièces jointes ────────────────────────────────────────────────

@pytest.mark.django_db
class TestAttachmentPermissions:
    """Seul le créateur peut ajouter ou supprimer des pièces jointes."""

    @pytest.fixture
    def non_creator(self, household):
        user = UserFactory(email="attachment-noncreator@example.com")
        _add_membership(user, household, role=HouseholdMember.Role.MEMBER)
        return user

    @pytest.fixture
    def task(self, household, owner, zone):
        return _create_task(household, owner, zone)

    # ── Documents ─────────────────────────────────────────────────────────────

    def test_non_creator_cannot_link_document(self, non_creator, task, document):
        client = _client_for(non_creator)
        url = reverse("task-document-list")
        response = client.post(
            url,
            {"task": str(task.id), "document": str(document.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_non_creator_cannot_delete_document_link(self, non_creator, task, document):
        link = TaskDocument.objects.create(task=task, document=document)
        client = _client_for(non_creator)
        url = reverse("task-document-detail", args=[link.id])
        response = client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert TaskDocument.objects.filter(id=link.id).exists()

    def test_creator_can_link_document(self, owner_client, task, document):
        url = reverse("task-document-list")
        response = owner_client.post(
            url,
            {"task": str(task.id), "document": str(document.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_creator_can_delete_document_link(self, owner_client, task, document):
        link = TaskDocument.objects.create(task=task, document=document)
        url = reverse("task-document-detail", args=[link.id])
        response = owner_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    # ── Interactions ──────────────────────────────────────────────────────────

    def test_non_creator_cannot_link_interaction(self, non_creator, task, interaction):
        client = _client_for(non_creator)
        url = reverse("task-interaction-list")
        response = client.post(
            url,
            {"task": str(task.id), "interaction": str(interaction.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_non_creator_cannot_delete_interaction_link(self, non_creator, task, interaction):
        link = TaskInteraction.objects.create(task=task, interaction=interaction)
        client = _client_for(non_creator)
        url = reverse("task-interaction-detail", args=[link.id])
        response = client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert TaskInteraction.objects.filter(id=link.id).exists()

    def test_creator_can_link_interaction(self, owner_client, task, interaction):
        url = reverse("task-interaction-list")
        response = owner_client.post(
            url,
            {"task": str(task.id), "interaction": str(interaction.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_creator_can_delete_interaction_link(self, owner_client, task, interaction):
        link = TaskInteraction.objects.create(task=task, interaction=interaction)
        url = reverse("task-interaction-detail", args=[link.id])
        response = owner_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
