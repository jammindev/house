from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from documents.models import Document
from directory.models import Contact
from households.models import Household, HouseholdMember
from interactions.models import Interaction, InteractionContact, InteractionDocument
from projects.models import Project
from tags.models import Tag, TagLink
from zones.models import Zone


def _create_household(name: str) -> Household:
    return Household.objects.create(name=name)


def _add_membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _create_zone(household, user, name: str) -> Zone:
    return Zone.objects.create(household=household, name=name, created_by=user)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def owner(db):
    return UserFactory(email="interactions-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _create_household("Interactions House")
    _add_membership(owner, instance, role=HouseholdMember.Role.OWNER)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def primary_zone(household, owner):
    return _create_zone(household, owner, "Kitchen")


@pytest.fixture
def secondary_zone(household, owner):
    return _create_zone(household, owner, "Garage")


def _interaction_payload(zone_ids, **overrides):
    payload = {
        "subject": "Replace filter",
        "content": "Changed the ventilation filter.",
        "type": "maintenance",
        "status": "pending",
        "occurred_at": timezone.now().isoformat(),
        "zone_ids": [str(zone_id) for zone_id in zone_ids],
        "tags_input": ["maintenance", "urgent"],
        "metadata": {"cost": 42},
        "enriched_text": "ventilation filter replaced",
        "is_private": False,
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
class TestInteractionCrud:
    def test_create_interaction_links_zones_and_normalizes_tags(self, owner_client, household, owner, primary_zone):
        url = reverse("interaction-list")
        response = owner_client.post(
            url,
            _interaction_payload([primary_zone.id], tags_input=[" urgent ", "urgent", "maintenance"]),
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        interaction = Interaction.objects.get(id=response.data["id"])
        assert interaction.household == household
        assert interaction.created_by == owner
        assert list(interaction.zones.values_list("id", flat=True)) == [primary_zone.id]
        assert set(response.data["tags"]) == {"urgent", "maintenance"}
        assert Tag.objects.filter(household=household, name="urgent", type=Tag.TagType.INTERACTION).exists()
        assert TagLink.objects.filter(household=household, object_id=str(interaction.id)).count() == 2

    def test_create_expense_persists_metadata(self, owner_client, household, owner, primary_zone):
        url = reverse("interaction-list")
        response = owner_client.post(
            url,
            _interaction_payload([primary_zone.id], type="expense", metadata={"amount": 149.9, "currency": "EUR"}),
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        interaction = Interaction.objects.get(id=response.data["id"])
        assert interaction.type == "expense"
        assert interaction.metadata["amount"] == 149.9
        assert interaction.metadata["currency"] == "EUR"

    def test_create_interaction_links_documents_atomically(self, owner_client, household, owner, primary_zone):
        document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path='docs/invoice.pdf',
            name='Invoice',
            mime_type='application/pdf',
            type='invoice',
        )

        url = reverse("interaction-list")
        response = owner_client.post(
            url,
            _interaction_payload([primary_zone.id], document_ids=[str(document.id)]),
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        interaction = Interaction.objects.get(id=response.data["id"])
        assert InteractionDocument.objects.filter(interaction=interaction, document=document).exists()
        assert response.data["linked_document_ids"] == [str(document.id)]

    def test_create_interaction_rejects_document_from_another_household_atomically(self, owner_client, household, owner, primary_zone):
        other_household = _create_household("Other Document House")
        _add_membership(owner, other_household)
        foreign_document = Document.objects.create(
            household=other_household,
            created_by=owner,
            file_path='docs/foreign.pdf',
            name='Foreign',
            mime_type='application/pdf',
            type='document',
        )

        url = reverse("interaction-list")
        response = owner_client.post(
            url,
            _interaction_payload([primary_zone.id], subject="Reject foreign doc", document_ids=[str(foreign_document.id)]),
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "document_ids" in response.data
        assert not Interaction.objects.filter(subject="Reject foreign doc", household=household).exists()

    def test_create_requires_at_least_one_zone(self, owner_client, household):
        url = reverse("interaction-list")
        payload = _interaction_payload([])
        response = owner_client.post(url, payload, format="json", HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone_ids" in response.data

    def test_create_rejects_zone_outside_user_households(self, owner_client, household, primary_zone):
        outsider = UserFactory(email="interactions-outsider@example.com")
        outsider_household = _create_household("Other House")
        _add_membership(outsider, outsider_household)
        forbidden_zone = _create_zone(outsider_household, outsider, "Forbidden")

        url = reverse("interaction-list")
        response = owner_client.post(
            url,
            _interaction_payload([primary_zone.id, forbidden_zone.id]),
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone_ids" in response.data

    def test_create_rejects_selected_household_mismatch(self, owner_client, owner, primary_zone):
        other_household = _create_household("Mismatch House")
        _add_membership(owner, other_household)

        url = reverse("interaction-list")
        response = owner_client.post(
            url,
            _interaction_payload([primary_zone.id]),
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(other_household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "household_id" in response.data

    def test_patch_updates_zones_and_replaces_tags(self, owner_client, household, owner, primary_zone, secondary_zone):
        interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Old subject",
            content="Old content",
            type="maintenance",
            status="pending",
            occurred_at=timezone.now(),
        )
        interaction.zones.add(primary_zone)
        old_tag = Tag.objects.create(
            household=household,
            created_by=owner,
            type=Tag.TagType.INTERACTION,
            name="obsolete",
        )
        TagLink.objects.create(household=household, created_by=owner, tag=old_tag, content_object=interaction)

        url = reverse("interaction-detail", kwargs={"pk": interaction.id})
        response = owner_client.patch(
            url,
            {
                "subject": "Updated subject",
                "zone_ids": [str(secondary_zone.id)],
                "tags_input": ["fresh", "urgent"],
            },
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_200_OK
        interaction.refresh_from_db()
        assert interaction.subject == "Updated subject"
        assert list(interaction.zones.values_list("id", flat=True)) == [secondary_zone.id]
        assert set(response.data["tags"]) == {"fresh", "urgent"}
        assert not TagLink.objects.filter(household=household, tag=old_tag, object_id=str(interaction.id)).exists()

    def test_retrieve_includes_zone_details_and_documents_key(self, owner_client, household, owner, primary_zone):
        interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Inspect boiler",
            content="Annual inspection",
            type="inspection",
            occurred_at=timezone.now(),
        )
        interaction.zones.add(primary_zone)

        url = reverse("interaction-detail", kwargs={"pk": interaction.id})
        response = owner_client.get(url, HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["zones_detail"][0]["id"] == str(primary_zone.id)
        assert response.data["documents"] == []


@pytest.mark.django_db
class TestInteractionQuerying:
    def test_list_is_scoped_to_selected_household(self, owner_client, owner, household, primary_zone):
        other_household = _create_household("Hidden House")
        _add_membership(owner, other_household)
        hidden_zone = _create_zone(other_household, owner, "Attic")

        visible = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Visible",
            type="note",
            occurred_at=timezone.now(),
        )
        visible.zones.add(primary_zone)
        hidden = Interaction.objects.create(
            household=other_household,
            created_by=owner,
            subject="Hidden",
            type="note",
            occurred_at=timezone.now(),
        )
        hidden.zones.add(hidden_zone)

        url = reverse("interaction-list")
        response = owner_client.get(url, HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_200_OK
        subjects = {item["subject"] for item in response.data["results"]}
        assert subjects == {"Visible"}

    def test_list_can_filter_by_zone_and_tags(self, owner_client, household, owner, primary_zone, secondary_zone):
        targeted = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Targeted",
            type="todo",
            status="backlog",
            occurred_at=timezone.now(),
        )
        targeted.zones.add(primary_zone)
        other = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Other",
            type="todo",
            status="done",
            occurred_at=timezone.now() - timedelta(days=1),
        )
        other.zones.add(secondary_zone)
        tag = Tag.objects.create(household=household, created_by=owner, type=Tag.TagType.INTERACTION, name="repair")
        TagLink.objects.create(household=household, created_by=owner, tag=tag, content_object=targeted)

        url = reverse("interaction-list")
        response = owner_client.get(
            url,
            {"zone": str(primary_zone.id), "tags": "repair"},
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_200_OK
        subjects = [item["subject"] for item in response.data["results"]]
        assert subjects == ["Targeted"]

    def test_search_matches_tag_names(self, owner_client, household, owner, primary_zone):
        interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Inspect roof",
            type="inspection",
            occurred_at=timezone.now(),
        )
        interaction.zones.add(primary_zone)
        tag = Tag.objects.create(household=household, created_by=owner, type=Tag.TagType.INTERACTION, name="roof")
        TagLink.objects.create(household=household, created_by=owner, tag=tag, content_object=interaction)

        url = reverse("interaction-list")
        response = owner_client.get(url, {"search": "roof"}, HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["subject"] == "Inspect roof"


@pytest.mark.django_db
class TestInteractionCustomActions:
    def test_by_type_returns_counts_for_selected_household(self, owner_client, household, owner, primary_zone):
        note = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Note one",
            type="note",
            occurred_at=timezone.now(),
        )
        todo = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Todo one",
            type="todo",
            status="pending",
            occurred_at=timezone.now(),
        )
        note.zones.add(primary_zone)
        todo.zones.add(primary_zone)

        url = reverse("interaction-by-type")
        response = owner_client.get(url, HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["note"]["count"] == 1
        assert response.data["todo"]["count"] == 1

    def test_tasks_groups_todos_by_status(self, owner_client, household, owner, primary_zone):
        backlog = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Backlog task",
            type="todo",
            status="backlog",
            occurred_at=timezone.now(),
        )
        done = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Done task",
            type="todo",
            status="done",
            occurred_at=timezone.now(),
        )
        backlog.zones.add(primary_zone)
        done.zones.add(primary_zone)

        url = reverse("interaction-tasks")
        response = owner_client.get(url, HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_200_OK
        assert [item["subject"] for item in response.data["backlog"]] == ["Backlog task"]
        assert [item["subject"] for item in response.data["done"]] == ["Done task"]

    def test_update_status_validates_choice(self, owner_client, household, owner, primary_zone):
        interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Status task",
            type="todo",
            status="pending",
            occurred_at=timezone.now(),
        )
        interaction.zones.add(primary_zone)

        url = reverse("interaction-update-status", kwargs={"pk": interaction.id})
        invalid = owner_client.patch(
            url,
            {"status": "invalid"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )
        valid = owner_client.patch(
            url,
            {"status": "done"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert invalid.status_code == status.HTTP_400_BAD_REQUEST
        assert valid.status_code == status.HTTP_200_OK
        interaction.refresh_from_db()
        assert interaction.status == "done"


@pytest.mark.django_db
class TestInteractionLinks:
    def test_create_interaction_contact_link_for_owned_interaction(self, owner_client, household, owner, primary_zone):
        interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Call plumber",
            type="todo",
            occurred_at=timezone.now(),
        )
        interaction.zones.add(primary_zone)
        contact = Contact.objects.create(
            household=household,
            created_by=owner,
            first_name="Jane",
            last_name="Doe",
        )

        url = reverse("interaction-contact-list")
        response = owner_client.post(
            url,
            {"interaction": str(interaction.id), "contact": str(contact.id)},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert InteractionContact.objects.filter(interaction=interaction, contact=contact).exists()

    def test_create_interaction_contact_rejects_foreign_interaction(self, household, owner, primary_zone):
        other_user = UserFactory(email="foreign-link@example.com")
        other_household = _create_household("Other Link House")
        _add_membership(other_user, other_household)
        foreign_interaction = Interaction.objects.create(
            household=other_household,
            created_by=other_user,
            subject="Foreign interaction",
            type="note",
            occurred_at=timezone.now(),
        )
        foreign_zone = _create_zone(other_household, other_user, "Foreign zone")
        foreign_interaction.zones.add(foreign_zone)
        contact = Contact.objects.create(
            household=household,
            created_by=owner,
            first_name="John",
            last_name="Smith",
        )
        client = _client_for(owner)

        url = reverse("interaction-contact-list")
        response = client.post(
            url,
            {"interaction": str(foreign_interaction.id), "contact": str(contact.id)},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "interaction" in response.data

    def test_create_interaction_document_link_for_owned_resources(self, owner_client, household, owner, primary_zone):
        interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Attach receipt",
            type="expense",
            occurred_at=timezone.now(),
        )
        interaction.zones.add(primary_zone)
        document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path='docs/receipt.pdf',
            name='Receipt',
            mime_type='application/pdf',
            type='receipt',
        )

        url = reverse("interaction-document-list")
        response = owner_client.post(
            url,
            {"interaction": str(interaction.id), "document": str(document.id), "role": "attachment"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert InteractionDocument.objects.filter(interaction=interaction, document=document).exists()

    def test_create_interaction_document_rejects_household_mismatch(self, owner_client, household, owner, primary_zone):
        other_household = _create_household("Documents Elsewhere")
        _add_membership(owner, other_household)
        interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Attach invoice",
            type="expense",
            occurred_at=timezone.now(),
        )
        interaction.zones.add(primary_zone)
        document = Document.objects.create(
            household=other_household,
            created_by=owner,
            file_path='docs/other-invoice.pdf',
            name='Other invoice',
            mime_type='application/pdf',
            type='invoice',
        )

        url = reverse("interaction-document-list")
        response = owner_client.post(
            url,
            {"interaction": str(interaction.id), "document": str(document.id), "role": "attachment"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "document" in response.data

    def test_create_interaction_document_returns_conflict_for_duplicate_link(self, owner_client, household, owner, primary_zone):
        interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Already linked",
            type="note",
            occurred_at=timezone.now(),
        )
        interaction.zones.add(primary_zone)
        document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path='docs/already-linked.pdf',
            name='Already linked',
            mime_type='application/pdf',
            type='document',
        )
        InteractionDocument.objects.create(interaction=interaction, document=document, role='attachment')

        url = reverse("interaction-document-list")
        response = owner_client.post(
            url,
            {"interaction": str(interaction.id), "document": str(document.id), "role": "attachment"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data == {
            'code': 'already_linked',
            'detail': 'Exact document-interaction link already exists.',
        }

@pytest.mark.django_db
class TestInteractionProjectLink:
    def test_create_interaction_with_project_links_correctly(self, owner_client, household, owner, primary_zone):
        project = Project.objects.create(
            household=household,
            created_by=owner,
            title='Rénovation cuisine',
            type='renovation',
            status='active',
        )

        url = reverse("interaction-list")
        response = owner_client.post(
            url,
            _interaction_payload([primary_zone.id], type="todo", project=str(project.id)),
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        interaction = Interaction.objects.get(id=response.data["id"])
        assert interaction.project == project

    def test_list_interactions_filtered_by_project(self, owner_client, household, owner, primary_zone):
        project = Project.objects.create(
            household=household,
            created_by=owner,
            title='Projet filtrage',
            type='other',
            status='active',
        )
        linked = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject='Tâche du projet',
            type='todo',
            occurred_at=timezone.now(),
            project=project,
        )
        linked.zones.add(primary_zone)
        unlinked = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject='Tâche sans projet',
            type='todo',
            occurred_at=timezone.now(),
        )
        unlinked.zones.add(primary_zone)

        url = reverse("interaction-list")
        response = owner_client.get(
            url,
            {"project": str(project.id)},
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_200_OK
        result_ids = {item["id"] for item in response.data.get("results", response.data)}
        assert str(linked.id) in result_ids
        assert str(unlinked.id) not in result_ids

    def test_patch_interaction_does_not_erase_project(self, owner_client, household, owner, primary_zone):
        project = Project.objects.create(
            household=household,
            created_by=owner,
            title='Projet stable',
            type='other',
            status='active',
        )
        interaction = Interaction.objects.create(
            household=household,
            created_by=owner,
            subject='Tâche initiale',
            type='todo',
            occurred_at=timezone.now(),
            project=project,
        )
        interaction.zones.add(primary_zone)

        url = reverse("interaction-detail", kwargs={"pk": interaction.id})
        response = owner_client.patch(
            url,
            {"subject": "Tâche mise à jour"},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_200_OK
        interaction.refresh_from_db()
        assert interaction.subject == "Tâche mise à jour"
        assert interaction.project == project
