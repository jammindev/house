"""
Tests for the ?due_before=YYYY-MM-DD filter added to TaskViewSet (lot 1, #226).

GET /api/tasks/tasks/?due_before=YYYY-MM-DD returns tasks whose due_date <=
due_before (inclusive bound).

Covers:
  - inclusive bound (task on the exact date is returned)
  - exclusive: task one day past the bound is excluded
  - tasks without due_date are always excluded by the filter
  - invalid date format → 400 with 'due_before' key in the error body
  - combination with ?status= filter works correctly
  - household isolation: filter still scopes to the active household
"""

from datetime import date, timedelta

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from tasks.models import Task
from zones.models import Zone


# ── Helpers ──────────────────────────────────────────────────────────────────

def _create_household(name: str) -> Household:
    return Household.objects.create(name=name)


def _add_membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _root_zone(household: Household) -> Zone:
    return Zone.objects.get(household=household, parent__isnull=True)


def _create_task(household, user, *, subject: str = "Task", due_date=None, task_status: str = "pending") -> Task:
    return Task.objects.create(
        household=household,
        created_by=user,
        subject=subject,
        due_date=due_date,
        status=task_status,
    )


def _due_before_url(due_before: str, extra: str = "") -> str:
    base = reverse("task-list")
    params = f"due_before={due_before}"
    if extra:
        params = f"{params}&{extra}"
    return f"{base}?{params}"


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return UserFactory(email="tasks-due-before@example.com")


@pytest.fixture
def household(db, owner):
    hh = _create_household("Due Before House")
    _add_membership(owner, hh)
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def owner_client(owner, household):
    return _client_for(owner)


# ── Core filter behaviour ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTaskDueBeforeFilter:
    """Covers the ?due_before= filter: bounds, edge cases, validation."""

    def test_task_on_exact_date_is_returned(self, owner_client, household, owner):
        """Inclusive bound: task with due_date == due_before must appear."""
        target_date = date(2026, 7, 14)
        _create_task(household, owner, subject="On the day", due_date=target_date)

        response = owner_client.get(_due_before_url("2026-07-14"))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        subjects = [t["subject"] for t in results]
        assert "On the day" in subjects

    def test_task_before_bound_is_returned(self, owner_client, household, owner):
        """Task with due_date earlier than due_before must appear."""
        _create_task(household, owner, subject="Before bound", due_date=date(2026, 7, 10))
        response = owner_client.get(_due_before_url("2026-07-14"))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        subjects = [t["subject"] for t in results]
        assert "Before bound" in subjects

    def test_task_one_day_past_bound_is_excluded(self, owner_client, household, owner):
        """Task with due_date == due_before + 1 day must NOT appear."""
        _create_task(household, owner, subject="After bound", due_date=date(2026, 7, 15))
        response = owner_client.get(_due_before_url("2026-07-14"))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        subjects = [t["subject"] for t in results]
        assert "After bound" not in subjects

    def test_task_without_due_date_excluded(self, owner_client, household, owner):
        """Tasks with no due_date are never included when the filter is active."""
        _create_task(household, owner, subject="No due date", due_date=None)
        response = owner_client.get(_due_before_url("2026-07-14"))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        subjects = [t["subject"] for t in results]
        assert "No due date" not in subjects

    def test_invalid_date_returns_400(self, owner_client, household):
        """A non-ISO date string must produce a 400 with 'due_before' in the error body."""
        response = owner_client.get(_due_before_url("not-a-date"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "due_before" in response.data

    def test_invalid_date_format_slash_returns_400(self, owner_client, household):
        """DD/MM/YYYY format is not ISO — must produce 400."""
        response = owner_client.get(_due_before_url("14/07/2026"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "due_before" in response.data

    def test_combined_with_status_filter(self, owner_client, household, owner):
        """?due_before= and ?status= applied together narrow the result set."""
        target_date = date(2026, 7, 14)
        _create_task(household, owner, subject="Pending within", due_date=target_date, task_status="pending")
        _create_task(household, owner, subject="Done within", due_date=target_date, task_status="done")
        _create_task(household, owner, subject="Pending outside", due_date=date(2026, 7, 20), task_status="pending")

        response = owner_client.get(_due_before_url("2026-07-14", extra="status=pending"))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        subjects = [t["subject"] for t in results]
        assert "Pending within" in subjects
        assert "Done within" not in subjects
        assert "Pending outside" not in subjects

    def test_multiple_tasks_all_on_or_before_bound_returned(self, owner_client, household, owner):
        """All tasks within the window are returned together."""
        _create_task(household, owner, subject="Day 10", due_date=date(2026, 7, 10))
        _create_task(household, owner, subject="Day 14", due_date=date(2026, 7, 14))
        _create_task(household, owner, subject="Day 20", due_date=date(2026, 7, 20))

        response = owner_client.get(_due_before_url("2026-07-14"))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        subjects = [t["subject"] for t in results]
        assert "Day 10" in subjects
        assert "Day 14" in subjects
        assert "Day 20" not in subjects

    def test_filter_scoped_to_active_household(self, owner_client, household, owner):
        """Tasks from another household must not appear, even if they match the date filter."""
        target_date = date(2026, 7, 14)
        other_owner = UserFactory(email="tasks-due-before-other@example.com")
        other_hh = _create_household("Other Due Before House")
        _add_membership(other_owner, other_hh)
        # Task in the other household within the date window
        _create_task(other_hh, other_owner, subject="Foreign task", due_date=target_date)
        # Own task also within the window
        _create_task(household, owner, subject="Own task", due_date=target_date)

        response = owner_client.get(_due_before_url("2026-07-14"))
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        subjects = [t["subject"] for t in results]
        assert "Own task" in subjects
        assert "Foreign task" not in subjects

    def test_anonymous_request_rejected(self, household):
        client = APIClient()
        response = client.get(_due_before_url("2026-07-14"))
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
