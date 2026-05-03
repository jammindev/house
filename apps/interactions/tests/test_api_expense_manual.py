"""Tests for POST /api/interactions/expenses/manual/."""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone


def _create_household(name: str) -> Household:
    return Household.objects.create(name=name)


def _add_membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def owner(db):
    return UserFactory(email="adhoc-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _create_household("Adhoc House")
    _add_membership(owner, instance, role=HouseholdMember.Role.OWNER)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def zone(household, owner):
    return Zone.objects.create(household=household, name="Living room", created_by=owner)


@pytest.mark.django_db
class TestManualExpenseEndpoint:
    def url(self):
        return reverse("interaction-expenses-manual")

    def test_create_manual_expense(self, owner_client, household, owner):
        response = owner_client.post(
            self.url(),
            data={
                "subject": "Restaurant Le Bistrot",
                "amount": "32.00",
                "supplier": "Le Bistrot",
                "occurred_at": "2026-05-03T12:00:00Z",
                "notes": "Déjeuner Sophie",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.content
        data = response.data
        assert data["subject"] == "Restaurant Le Bistrot"
        assert data["type"] == "expense"
        assert data["metadata"]["kind"] == "manual"
        assert data["metadata"]["amount"] == "32.00"
        assert data["metadata"]["supplier"] == "Le Bistrot"
        assert data["metadata"]["source_name"] is None
        assert data["source_type"] is None

        interaction = Interaction.objects.get(id=data["id"])
        assert interaction.household_id == household.id
        assert interaction.created_by == owner
        assert interaction.source_content_type_id is None
        assert interaction.source_object_id is None

    def test_create_manual_expense_without_amount(self, owner_client, household):
        response = owner_client.post(
            self.url(),
            data={"subject": "Cinema night"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.content
        assert response.data["metadata"]["amount"] is None

    def test_subject_is_required(self, owner_client, household):
        response = owner_client.post(
            self.url(),
            data={"amount": "10"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "subject" in response.data

    def test_subject_blank_rejected(self, owner_client, household):
        response = owner_client.post(
            self.url(),
            data={"subject": "   "},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_negative_amount_rejected(self, owner_client, household):
        response = owner_client.post(
            self.url(),
            data={"subject": "Cinema", "amount": "-5"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_zone_must_belong_to_household(self, owner_client, household, owner):
        other_house = _create_household("Other house")
        foreign_zone = Zone.objects.create(
            household=other_house, name="Foreign", created_by=owner
        )
        response = owner_client.post(
            self.url(),
            data={"subject": "Test", "zone_ids": [str(foreign_zone.id)]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_zone_attached_when_valid(self, owner_client, household, zone):
        response = owner_client.post(
            self.url(),
            data={"subject": "Cinema", "zone_ids": [str(zone.id)]},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.content
        interaction = Interaction.objects.get(id=response.data["id"])
        assert list(interaction.zones.values_list("id", flat=True)) == [zone.id]

    def test_unauthenticated_rejected(self, db):
        client = APIClient()
        response = client.post(
            reverse("interaction-expenses-manual"),
            data={"subject": "Cinema"},
            format="json",
        )
        assert response.status_code in (401, 403)

    def test_appears_in_summary_endpoint(self, owner_client, household):
        response = owner_client.post(
            self.url(),
            data={"subject": "Cinema", "amount": "12.50"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

        summary = owner_client.get(reverse("interaction-expenses-summary"))
        assert summary.status_code == status.HTTP_200_OK
        assert summary.data["total"] == "12.50"
        kinds = {row["kind"] for row in summary.data["by_kind"]}
        assert "manual" in kinds
