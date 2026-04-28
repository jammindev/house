from datetime import date, timedelta

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from equipment.models import Equipment
from households.models import Household, HouseholdMember
from tasks.models import Task, TaskZone
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


def _create_overdue_task(household, owner, *, days_overdue: int, subject: str = "Late task") -> Task:
    task = Task.objects.create(
        household=household,
        created_by=owner,
        subject=subject,
        due_date=date.today() - timedelta(days=days_overdue),
        status=Task.Status.PENDING,
    )
    TaskZone.objects.create(task=task, zone=_root_zone(household))
    return task


def _create_equipment(household, owner, *, name: str = "Lave-vaisselle", **fields) -> Equipment:
    return Equipment.objects.create(
        household=household,
        name=name,
        zone=_root_zone(household),
        created_by=owner,
        **fields,
    )


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return UserFactory(email="alerts-owner@example.com")


@pytest.fixture
def household(db, owner):
    hh = _create_household("Alerts House")
    _add_membership(owner, hh)
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


@pytest.fixture
def owner_client(owner, household):
    return _client_for(owner)


# ── Tests ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAlertsSummary:
    def _url(self):
        return reverse("alerts-summary")

    def test_overdue_tasks_returned(self, owner_client, household, owner):
        _create_overdue_task(household, owner, days_overdue=5, subject="Plombier")
        response = owner_client.get(self._url())

        assert response.status_code == status.HTTP_200_OK
        overdue = response.data["overdue_tasks"]
        assert len(overdue) == 1
        assert overdue[0]["title"] == "Plombier"
        assert overdue[0]["days_overdue"] == 5
        assert overdue[0]["severity"] == "critical"
        assert overdue[0]["entity_url"] == "/app/tasks"

    def test_overdue_severity_warning_when_recent(self, owner_client, household, owner):
        _create_overdue_task(household, owner, days_overdue=1)
        response = owner_client.get(self._url())
        assert response.data["overdue_tasks"][0]["severity"] == "warning"

    def test_done_tasks_excluded(self, owner_client, household, owner):
        task = _create_overdue_task(household, owner, days_overdue=10)
        task.status = Task.Status.DONE
        task.save(update_fields=["status"])
        response = owner_client.get(self._url())
        assert response.data["overdue_tasks"] == []

    def test_future_tasks_excluded(self, owner_client, household, owner):
        future_task = Task.objects.create(
            household=household,
            created_by=owner,
            subject="Plus tard",
            due_date=date.today() + timedelta(days=3),
            status=Task.Status.PENDING,
        )
        TaskZone.objects.create(task=future_task, zone=_root_zone(household))
        response = owner_client.get(self._url())
        assert response.data["overdue_tasks"] == []

    def test_expiring_warranty_critical(self, owner_client, household, owner):
        _create_equipment(
            household,
            owner,
            name="Bosch SMV",
            warranty_expires_on=date.today() + timedelta(days=20),
        )
        response = owner_client.get(self._url())
        warranties = response.data["expiring_warranties"]
        assert len(warranties) == 1
        assert warranties[0]["severity"] == "critical"
        assert warranties[0]["days_remaining"] == 20

    def test_warranty_outside_window_excluded(self, owner_client, household, owner):
        # Trop loin (>90 jours)
        _create_equipment(
            household,
            owner,
            name="Far",
            warranty_expires_on=date.today() + timedelta(days=120),
        )
        # Déjà expirée (dans le passé)
        _create_equipment(
            household,
            owner,
            name="Expired",
            warranty_expires_on=date.today() - timedelta(days=1),
        )
        response = owner_client.get(self._url())
        assert response.data["expiring_warranties"] == []

    def test_due_maintenance_returned(self, owner_client, household, owner):
        # Dernier service il y a 11 mois, intervalle 12 mois → next_service_due dans ~1 mois
        _create_equipment(
            household,
            owner,
            name="Chaudière",
            last_service_at=date.today() - timedelta(days=335),
            maintenance_interval_months=12,
        )
        response = owner_client.get(self._url())
        maintenances = response.data["due_maintenances"]
        assert len(maintenances) == 1
        assert maintenances[0]["title"] == "Chaudière"
        assert 25 <= maintenances[0]["days_remaining"] <= 35

    def test_household_isolation(self, owner_client, household, owner):
        # Données d'un autre household ne doivent pas remonter
        other_owner = UserFactory(email="other@example.com")
        other_hh = _create_household("Other")
        _add_membership(other_owner, other_hh)
        _create_overdue_task(other_hh, other_owner, days_overdue=10, subject="Other late")
        _create_equipment(
            other_hh,
            other_owner,
            name="Other warranty",
            warranty_expires_on=date.today() + timedelta(days=10),
        )
        response = owner_client.get(self._url())
        assert response.data["total"] == 0

    def test_total_is_sum_of_three_lists(self, owner_client, household, owner):
        _create_overdue_task(household, owner, days_overdue=4, subject="A")
        _create_overdue_task(household, owner, days_overdue=2, subject="B")
        _create_equipment(
            household,
            owner,
            name="Warranty",
            warranty_expires_on=date.today() + timedelta(days=15),
        )
        _create_equipment(
            household,
            owner,
            name="Maint",
            last_service_at=date.today() - timedelta(days=335),
            maintenance_interval_months=12,
        )
        response = owner_client.get(self._url())
        assert response.data["total"] == (
            len(response.data["overdue_tasks"])
            + len(response.data["expiring_warranties"])
            + len(response.data["due_maintenances"])
        )
        assert response.data["total"] == 4

    def test_unauthenticated_request_rejected(self, household):
        client = APIClient()
        response = client.get(self._url())
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
