"""Tests for tasks.services.create_task (shared by API + agent write tool)."""
from __future__ import annotations

import pytest

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from tasks.models import Task, TaskZone
from tasks.services import create_task
from zones.models import Zone


@pytest.fixture
def owner(db):
    return UserFactory(email="tasks-services-owner@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Services House")
    HouseholdMember.objects.create(user=owner, household=hh, role=HouseholdMember.Role.OWNER)
    return hh


class TestCreateTask:
    def test_falls_back_to_root_zone_when_none_given(self, household, owner):
        # A household auto-creates its root zone via signal.
        root = Zone.objects.get(household=household, parent__isnull=True)

        task = create_task(household, owner, subject="Purger la VMC")

        assert task.household_id == household.id
        assert task.created_by_id == owner.id
        assert list(task.zones.values_list("id", flat=True)) == [root.id]

    def test_optional_fields(self, household, owner):
        task = create_task(
            household,
            owner,
            subject="Commander la PAC",
            content="chez Wood Co.",
            priority=2,
            due_date="2026-09-15",
        )
        assert task.content == "chez Wood Co."
        assert task.priority == 2
        assert str(task.due_date) == "2026-09-15"

    def test_explicit_zone_is_used(self, household, owner):
        zone = Zone.objects.create(household=household, name="Chaufferie", created_by=owner)
        task = create_task(
            household, owner, subject="Vérifier la chaudière", zone_ids=[str(zone.id)]
        )
        assert TaskZone.objects.filter(task=task, zone=zone).exists()

    def test_with_project(self, household, owner):
        from projects.models import Project

        project = Project.objects.create(
            household=household, created_by=owner, title="Rénovation"
        )
        task = create_task(household, owner, subject="Devis", project=project)
        assert task.project_id == project.pk

    def test_missing_subject_raises(self, household, owner):
        from rest_framework.exceptions import ValidationError

        with pytest.raises(ValidationError):
            create_task(household, owner, subject="")
        assert not Task.objects.filter(household=household).exists()
