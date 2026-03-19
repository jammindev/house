from datetime import date, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from tasks.models import Task, TaskZone
from zones.models import Zone


# ── Helpers ──────────────────────────────────────────────────────────────────

def _create_household(name: str) -> Household:
    return Household.objects.create(name=name)


def _add_membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _create_zone(household, user, name: str = "Kitchen") -> Zone:
    return Zone.objects.create(household=household, name=name, created_by=user)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _task_payload(zone_ids, **overrides):
    payload = {
        "subject": "Fix the leak",
        "content": "Under the sink.",
        "zone_ids": [str(z) for z in zone_ids],
    }
    payload.update(overrides)
    return payload


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return UserFactory(email="tasks-owner@example.com")


@pytest.fixture
def household(db, owner):
    hh = _create_household("Tasks House")
    _add_membership(owner, hh)
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def zone(household, owner):
    return _create_zone(household, owner)


# ── CRUD ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTaskCrud:
    def test_create_sets_household_and_created_by(self, owner_client, household, owner, zone):
        url = reverse("task-list")
        response = owner_client.post(
            url,
            _task_payload([zone.id]),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        task = Task.objects.get(id=response.data["id"])
        assert task.household == household
        assert task.created_by == owner
        assert list(task.zones.values_list("id", flat=True)) == [zone.id]

    def test_create_without_due_date_succeeds(self, owner_client, household, zone):
        url = reverse("task-list")
        response = owner_client.post(
            url,
            _task_payload([zone.id]),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["due_date"] is None

    def test_create_with_due_date(self, owner_client, household, zone):
        url = reverse("task-list")
        response = owner_client.post(
            url,
            _task_payload([zone.id], due_date="2026-06-01"),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["due_date"] == "2026-06-01"

    def test_create_requires_at_least_one_zone(self, owner_client, household):
        url = reverse("task-list")
        response = owner_client.post(
            url,
            _task_payload([]),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone_ids" in response.data

    def test_create_rejects_zone_from_other_household(self, owner_client, household, owner):
        other_hh = _create_household("Other House")
        other_zone = _create_zone(other_hh, owner, "Garage")
        url = reverse("task-list")
        response = owner_client.post(
            url,
            _task_payload([other_zone.id]),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_updates_subject(self, owner_client, household, owner, zone):
        task = Task.objects.create(
            household=household, created_by=owner, subject="Old subject"
        )
        TaskZone.objects.create(task=task, zone=zone)
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(
            url, {"subject": "New subject"}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        task.refresh_from_db()
        assert task.subject == "New subject"
        assert task.updated_by == owner

    def test_delete_task(self, owner_client, household, owner, zone):
        task = Task.objects.create(
            household=household, created_by=owner, subject="To delete"
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        # Soft delete: task is archived, not removed from DB
        task.refresh_from_db()
        assert task.status == Task.Status.ARCHIVED


# ── Scoping ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTaskScoping:
    def test_list_scoped_to_selected_household(self, owner_client, household, owner):
        other_hh = _create_household("Other House")
        other_user = UserFactory(email="other-scoping@example.com")
        _add_membership(other_user, other_hh)

        Task.objects.create(household=household, created_by=owner, subject="Mine")
        Task.objects.create(household=other_hh, created_by=other_user, subject="Theirs")

        url = reverse("task-list")
        response = owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        subjects = [t["subject"] for t in response.data.get("results", response.data)]
        assert "Mine" in subjects
        assert "Theirs" not in subjects

    def test_list_filters_by_status(self, owner_client, household, owner):
        Task.objects.create(household=household, created_by=owner, subject="Done", status="done")
        Task.objects.create(household=household, created_by=owner, subject="Pending", status="pending")

        url = reverse("task-list")
        response = owner_client.get(url + "?status=done")
        subjects = [t["subject"] for t in response.data.get("results", response.data)]
        assert "Done" in subjects
        assert "Pending" not in subjects

    def test_list_filters_overdue(self, owner_client, household, owner):
        yesterday = (timezone.now() - timedelta(days=1)).date()
        tomorrow = (timezone.now() + timedelta(days=1)).date()
        Task.objects.create(household=household, created_by=owner, subject="Overdue", due_date=yesterday)
        Task.objects.create(household=household, created_by=owner, subject="Future", due_date=tomorrow)

        url = reverse("task-list")
        response = owner_client.get(url + "?overdue=true")
        subjects = [t["subject"] for t in response.data.get("results", response.data)]
        assert "Overdue" in subjects
        assert "Future" not in subjects

    def test_cannot_access_other_household_task(self, household, owner):
        other_user = UserFactory(email="other-access@example.com")
        other_hh = _create_household("Other House")
        _add_membership(other_user, other_hh)
        task = Task.objects.create(household=other_hh, created_by=other_user, subject="Private")

        client = _client_for(owner)
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Status transitions ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTaskStatusTransitions:
    def test_done_sets_completed_by_and_completed_at(self, owner_client, household, owner):
        task = Task.objects.create(
            household=household, created_by=owner, subject="Finish me"
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(
            url, {"status": "done"}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        task.refresh_from_db()
        assert task.status == "done"
        assert task.completed_by == owner
        assert task.completed_at is not None

    def test_revert_from_done_clears_completed_fields(self, owner_client, household, owner):
        task = Task.objects.create(
            household=household, created_by=owner, subject="Revert me",
            status="done", completed_by=owner, completed_at=timezone.now(),
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(
            url, {"status": "in_progress"}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        task.refresh_from_db()
        assert task.completed_by is None
        assert task.completed_at is None

    def test_invalid_status_rejected(self, owner_client, household, owner):
        task = Task.objects.create(
            household=household, created_by=owner, subject="Bad status"
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(
            url, {"status": "invalid_value"}, format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Assignment ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTaskAssignment:
    def test_assign_to_household_member(self, owner_client, household, owner):
        member = UserFactory(email="member-assign@example.com")
        _add_membership(member, household, role=HouseholdMember.Role.MEMBER)
        task = Task.objects.create(
            household=household, created_by=owner, subject="Assign me"
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(
            url, {"assigned_to_id": str(member.id)}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        task.refresh_from_db()
        assert task.assigned_to == member

    def test_assign_to_non_member_rejected(self, owner_client, household, owner):
        outsider = UserFactory(email="outsider-assign@example.com")
        task = Task.objects.create(
            household=household, created_by=owner, subject="Reject assign"
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(
            url, {"assigned_to_id": str(outsider.id)}, format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unassign_task(self, owner_client, household, owner):
        member = UserFactory(email="member-unassign@example.com")
        _add_membership(member, household)
        task = Task.objects.create(
            household=household, created_by=owner, subject="Unassign me",
            assigned_to=member,
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(
            url, {"assigned_to_id": None}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        task.refresh_from_db()
        assert task.assigned_to is None


# ── Contrainte : tâche privée ≠ assignée ─────────────────────────────────────

@pytest.mark.django_db
class TestPrivateTaskNotAssigned:
    """Une tâche privée ne peut pas avoir d'assignataire (ni à la création ni en update)."""

    def _member(self, household):
        user = UserFactory(email=f"member-priv-{UserFactory._meta.model._default_manager.count()}@example.com")
        _add_membership(user, household, role=HouseholdMember.Role.MEMBER)
        return user

    # ── Création ─────────────────────────────────────────────────────────────

    def test_create_private_with_assignee_rejected(self, owner_client, household, zone):
        member = UserFactory(email="priv-create-member@example.com")
        _add_membership(member, household)
        url = reverse("task-list")
        response = owner_client.post(
            url,
            {**_task_payload([zone.id]), "is_private": True, "assigned_to_id": str(member.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "assigned_to_id" in response.data

    def test_create_private_without_assignee_ok(self, owner_client, household, zone):
        url = reverse("task-list")
        response = owner_client.post(
            url,
            {**_task_payload([zone.id]), "is_private": True},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["is_private"] is True
        assert response.data["assigned_to"] is None

    def test_create_not_private_with_assignee_ok(self, owner_client, household, zone):
        member = UserFactory(email="priv-nopriv-member@example.com")
        _add_membership(member, household)
        url = reverse("task-list")
        response = owner_client.post(
            url,
            {**_task_payload([zone.id]), "is_private": False, "assigned_to_id": str(member.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    # ── Update : rendre privée une tâche assignée ─────────────────────────────

    def test_make_assigned_task_private_rejected(self, owner_client, household, owner, zone):
        member = UserFactory(email="priv-update1-member@example.com")
        _add_membership(member, household)
        task = Task.objects.create(
            household=household, created_by=owner, subject="Assigned task",
            assigned_to=member, is_private=False,
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(url, {"is_private": True}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "assigned_to_id" in response.data

    def test_assign_private_task_rejected(self, owner_client, household, owner, zone):
        member = UserFactory(email="priv-update2-member@example.com")
        _add_membership(member, household)
        task = Task.objects.create(
            household=household, created_by=owner, subject="Private task",
            is_private=True,
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(
            url, {"assigned_to_id": str(member.id)}, format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "assigned_to_id" in response.data

    def test_make_private_after_unassign_ok(self, owner_client, household, owner, zone):
        """Passer en privée après avoir retiré l'assignation dans le même PATCH."""
        member = UserFactory(email="priv-update3-member@example.com")
        _add_membership(member, household)
        task = Task.objects.create(
            household=household, created_by=owner, subject="Will be private",
            assigned_to=member, is_private=False,
        )
        url = reverse("task-detail", kwargs={"pk": str(task.id)})
        response = owner_client.patch(
            url, {"is_private": True, "assigned_to_id": None}, format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        task.refresh_from_db()
        assert task.is_private is True
        assert task.assigned_to is None
