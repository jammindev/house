from datetime import date

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from documents.models import Document
from projects.models import (
    Project,
    ProjectAIMessage,
    ProjectAIThread,
    ProjectDocument,
    ProjectGroup,
    ProjectZone,
    UserPinnedProject,
)
from zones.models import Zone


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _household(name: str) -> Household:
    return Household.objects.create(name=name)


def _membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _zone(household, user, name: str) -> Zone:
    return Zone.objects.create(household=household, name=name, created_by=user)


@pytest.fixture
def owner(db):
    return UserFactory(email="projects-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _household("Projects House")
    _membership(owner, instance, role=HouseholdMember.Role.OWNER)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def group(household, owner):
    return ProjectGroup.objects.create(household=household, created_by=owner, name="Renovation")


def _project_payload(**overrides):
    payload = {
        "title": "Kitchen refresh",
        "description": "Refresh the kitchen fronts.",
        "status": Project.Status.ACTIVE,
        "priority": 4,
        "start_date": date(2026, 3, 1).isoformat(),
        "due_date": date(2026, 3, 20).isoformat(),
        "tags": ["kitchen", "paint"],
        "planned_budget": "1500.00",
        "actual_cost_cached": "250.00",
        "type": Project.Type.RENOVATION,
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
class TestProjectGroups:
    def test_create_group_uses_household_context(self, owner_client, household):
        url = reverse("project-group-list")
        response = owner_client.post(
            url,
            {"name": "Outdoor", "description": "Garden work", "tags": ["garden"]},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        created = ProjectGroup.objects.get(id=response.data["id"])
        assert created.household == household
        assert response.data["projects_count"] == 0

    def test_list_groups_is_household_scoped(self, owner_client, owner, household, group):
        other_household = _household("Other Projects House")
        _membership(owner, other_household)
        ProjectGroup.objects.create(household=other_household, created_by=owner, name="Hidden")

        url = reverse("project-group-list")
        response = owner_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        names = [item["name"] for item in response.data]
        assert names == [group.name]


@pytest.mark.django_db
class TestProjects:
    def test_create_project_sets_household_and_creator(self, owner_client, household, owner, group):
        url = reverse("project-list")
        response = owner_client.post(
            url,
            _project_payload(project_group=str(group.id)),
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        project = Project.objects.get(id=response.data["id"])
        assert project.household == household
        assert project.created_by == owner
        assert response.data["project_group_name"] == group.name
        assert response.data["is_pinned"] is False

    def test_list_projects_is_household_scoped(self, owner_client, owner, household, group):
        visible = Project.objects.create(
            household=household,
            created_by=owner,
            title="Visible",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
            project_group=group,
        )
        other_household = _household("Other Project Scope")
        _membership(owner, other_household)
        Project.objects.create(
            household=other_household,
            created_by=owner,
            title="Hidden",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
        )

        url = reverse("project-list")
        response = owner_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        titles = [item["title"] for item in response.data]
        assert titles == [visible.title]

    def test_pin_and_unpin_project_toggle_is_pinned(self, owner_client, owner, household):
        project = Project.objects.create(
            household=household,
            created_by=owner,
            title="Pinned project",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
        )

        pin_url = reverse("project-pin", kwargs={"pk": project.id})
        unpin_url = reverse("project-unpin", kwargs={"pk": project.id})

        pin_response = owner_client.post(pin_url, {}, format="json")

        assert pin_response.status_code == status.HTTP_200_OK
        assert pin_response.data["is_pinned"] is True
        assert UserPinnedProject.objects.filter(project=project, household_member__user=owner).exists()

        unpin_response = owner_client.post(unpin_url, {}, format="json")
        assert unpin_response.status_code == status.HTTP_200_OK
        assert unpin_response.data["is_pinned"] is False
        assert not UserPinnedProject.objects.filter(project=project, household_member__user=owner).exists()


@pytest.mark.django_db
class TestProjectZones:
    def test_create_project_zone_in_same_household(self, owner_client, owner, household):
        project = Project.objects.create(
            household=household,
            created_by=owner,
            title="Zone project",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
        )
        zone = _zone(household, owner, "Kitchen")

        url = reverse("project-zone-list")
        response = owner_client.post(
            url,
            {"project": str(project.id), "zone": str(zone.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert ProjectZone.objects.filter(project=project, zone=zone).exists()

    def test_reject_project_zone_when_zone_household_differs(self, owner_client, owner, household):
        project = Project.objects.create(
            household=household,
            created_by=owner,
            title="Mismatch project",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
        )
        other_household = _household("Zone mismatch house")
        _membership(owner, other_household)
        zone = _zone(other_household, owner, "Attic")

        url = reverse("project-zone-list")
        response = owner_client.post(
            url,
            {"project": str(project.id), "zone": str(zone.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone" in response.data

    def test_reject_project_zone_for_inaccessible_project(self, owner_client, owner, household):
        outsider = UserFactory(email="projects-outsider@example.com")
        other_household = _household("Foreign project house")
        _membership(outsider, other_household)
        foreign_project = Project.objects.create(
            household=other_household,
            created_by=outsider,
            title="Foreign project",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
        )
        zone = _zone(other_household, outsider, "Foreign zone")

        url = reverse("project-zone-list")
        response = owner_client.post(
            url,
            {"project": str(foreign_project.id), "zone": str(zone.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "project" in response.data


@pytest.mark.django_db
class TestProjectAI:
    def test_create_thread_uses_selected_household_and_current_user(self, owner_client, owner, household):
        project = Project.objects.create(
            household=household,
            created_by=owner,
            title="AI project",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
        )

        url = reverse("project-ai-thread-list")
        response = owner_client.post(
            url,
            {"project": str(project.id), "title": "Planning thread"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        thread = ProjectAIThread.objects.get(id=response.data["id"])
        assert thread.household == household
        assert thread.user == owner

    def test_reject_thread_when_project_household_mismatches_selected_household(self, owner_client, owner, household):
        other_household = _household("Thread mismatch house")
        _membership(owner, other_household)
        foreign_project = Project.objects.create(
            household=other_household,
            created_by=owner,
            title="Foreign project",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
        )

        url = reverse("project-ai-thread-list")
        response = owner_client.post(
            url,
            {"project": str(foreign_project.id), "title": "Wrong thread"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "project" in response.data

    def test_create_message_for_owned_thread(self, owner_client, owner, household):
        project = Project.objects.create(
            household=household,
            created_by=owner,
            title="Message project",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
        )
        thread = ProjectAIThread.objects.create(
            project=project,
            household=household,
            user=owner,
            title="Main thread",
        )

        url = reverse("project-ai-message-list")
        response = owner_client.post(
            url,
            {"thread": str(thread.id), "role": ProjectAIMessage.Role.USER, "content": "What next?", "metadata": {"source": "ui"}},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert ProjectAIMessage.objects.filter(thread=thread, content="What next?").exists()

    def test_reject_message_for_inaccessible_thread(self, owner_client, owner, household):
        outsider = UserFactory(email="projects-thread-outsider@example.com")
        other_household = _household("Thread foreign house")
        _membership(outsider, other_household)
        foreign_project = Project.objects.create(
            household=other_household,
            created_by=outsider,
            title="Foreign thread project",
            status=Project.Status.ACTIVE,
            priority=3,
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
        )
        foreign_thread = ProjectAIThread.objects.create(
            project=foreign_project,
            household=other_household,
            user=outsider,
            title="Foreign thread",
        )

        url = reverse("project-ai-message-list")
        response = owner_client.post(
            url,
            {"thread": str(foreign_thread.id), "role": ProjectAIMessage.Role.USER, "content": "Leak?", "metadata": {}},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "thread" in response.data

@pytest.mark.django_db
class TestProjectZoneFilter:
    def test_list_projects_filtered_by_zone(self, owner_client, owner, household):
        zone_a = Zone.objects.create(household=household, name='Cuisine', created_by=owner)
        zone_b = Zone.objects.create(household=household, name='Salon', created_by=owner)

        project_a = Project.objects.create(
            household=household,
            created_by=owner,
            title='Projet cuisine',
            type=Project.Type.RENOVATION,
            status=Project.Status.ACTIVE,
        )
        ProjectZone.objects.create(project=project_a, zone=zone_a, created_by=owner)

        Project.objects.create(
            household=household,
            created_by=owner,
            title='Projet salon',
            type=Project.Type.RENOVATION,
            status=Project.Status.ACTIVE,
        )

        url = reverse('project-list')
        response = owner_client.get(
            url,
            {'zone': str(zone_a.id)},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        results = data['results'] if isinstance(data, dict) else data
        ids = [r['id'] for r in results]
        assert str(project_a.id) in ids
        assert all(pid == str(project_a.id) for pid in ids)

    def test_list_projects_filtered_by_status(self, owner_client, owner, household):
        Project.objects.create(
            household=household,
            created_by=owner,
            title='Projet actif',
            type=Project.Type.RENOVATION,
            status=Project.Status.ACTIVE,
        )
        Project.objects.create(
            household=household,
            created_by=owner,
            title='Projet terminé',
            type=Project.Type.RENOVATION,
            status=Project.Status.COMPLETED,
        )

        url = reverse('project-list')
        response = owner_client.get(
            url,
            {'status': 'active'},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        results = data['results'] if isinstance(data, dict) else data
        assert all(r['status'] == 'active' for r in results)


@pytest.mark.django_db
class TestProjectDocumentLinks:
    def _project(self, household, owner):
        return Project.objects.create(
            household=household,
            created_by=owner,
            title="Doc-attached project",
            status=Project.Status.ACTIVE,
            priority=3,
            type=Project.Type.OTHER,
        )

    def _document(self, household, owner, name="Plan", file_path="docs/plan.pdf"):
        return Document.objects.create(
            household=household,
            created_by=owner,
            file_path=file_path,
            name=name,
            mime_type="application/pdf",
            type="document",
        )

    def test_attach_document_creates_link(self, owner_client, owner, household):
        project = self._project(household, owner)
        document = self._document(household, owner)

        url = reverse("project-attach-document", kwargs={"pk": project.id})
        response = owner_client.post(url, {"document_id": str(document.id)}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert ProjectDocument.objects.filter(project=project, document=document).exists()

    def test_attach_document_is_idempotent(self, owner_client, owner, household):
        project = self._project(household, owner)
        document = self._document(household, owner)
        ProjectDocument.objects.create(project=project, document=document, created_by=owner)

        url = reverse("project-attach-document", kwargs={"pk": project.id})
        response = owner_client.post(url, {"document_id": str(document.id)}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert ProjectDocument.objects.filter(project=project, document=document).count() == 1

    def test_attach_document_rejects_other_household(self, owner_client, owner, household):
        project = self._project(household, owner)
        other = _household("Other House")
        _membership(owner, other)
        foreign_doc = self._document(other, owner, name="Foreign", file_path="docs/foreign.pdf")

        url = reverse("project-attach-document", kwargs={"pk": project.id})
        response = owner_client.post(url, {"document_id": str(foreign_doc.id)}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert not ProjectDocument.objects.filter(project=project, document=foreign_doc).exists()

    def test_detach_document_removes_link(self, owner_client, owner, household):
        project = self._project(household, owner)
        document = self._document(household, owner)
        ProjectDocument.objects.create(project=project, document=document, created_by=owner)

        url = reverse("project-detach-document", kwargs={"pk": project.id})
        response = owner_client.post(url, {"document_id": str(document.id)}, format="json")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ProjectDocument.objects.filter(project=project, document=document).exists()
        # Document itself is preserved
        assert Document.objects.filter(id=document.id).exists()

    def test_detach_document_returns_404_when_not_linked(self, owner_client, owner, household):
        project = self._project(household, owner)
        document = self._document(household, owner)

        url = reverse("project-detach-document", kwargs={"pk": project.id})
        response = owner_client.post(url, {"document_id": str(document.id)}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
