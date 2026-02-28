"""Household API tests — verifies SC-004: multi-tenant household operations."""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def owner_client(db, user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def household(db, user):
    h = Household.objects.create(name="Test Household")
    HouseholdMember.objects.create(household=h, user=user, role=HouseholdMember.Role.OWNER)
    return h


@pytest.mark.django_db
class TestCreateHousehold:
    """POST /api/households/ — creates household and enrolls owner."""

    def test_create_household_creates_membership(self, owner_client, user):
        url = reverse("household-list")
        response = owner_client.post(url, {"name": "My House"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        h_id = response.data["id"]
        assert HouseholdMember.objects.filter(
            household_id=h_id, user=user, role=HouseholdMember.Role.OWNER
        ).exists()

    def test_create_household_requires_auth(self, api_client):
        url = reverse("household-list")
        response = api_client.post(url, {"name": "Unauthorized"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_household_requires_name(self, owner_client):
        url = reverse("household-list")
        response = owner_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDeleteHousehold:
    """DELETE /api/households/{id}/ — owner can delete."""

    def test_owner_can_delete(self, owner_client, household):
        url = reverse("household-detail", kwargs={"pk": household.pk})
        response = owner_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Household.objects.filter(pk=household.pk).exists()

    def test_member_cannot_delete(self, db, household):
        member_user = UserFactory()
        HouseholdMember.objects.create(
            household=household, user=member_user, role=HouseholdMember.Role.MEMBER
        )
        client = APIClient()
        client.force_authenticate(user=member_user)
        url = reverse("household-detail", kwargs={"pk": household.pk})
        response = client.delete(url)
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)


@pytest.mark.django_db
class TestLeaveHousehold:
    """POST /api/households/{id}/leave/ — member can leave."""

    def test_member_can_leave(self, db, household):
        member_user = UserFactory()
        HouseholdMember.objects.create(
            household=household, user=member_user, role=HouseholdMember.Role.MEMBER
        )
        client = APIClient()
        client.force_authenticate(user=member_user)
        url = reverse("household-leave", kwargs={"pk": household.pk})
        response = client.post(url, {}, format="json")
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT)
        assert not HouseholdMember.objects.filter(household=household, user=member_user).exists()

    def test_last_owner_cannot_leave(self, owner_client, household, user):
        url = reverse("household-leave", kwargs={"pk": household.pk})
        response = owner_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestInviteHousehold:
    """POST /api/households/{id}/invite/ — owner invites a new user by email."""

    def test_owner_can_invite_existing_user(self, db, owner_client, household):
        new_user = UserFactory(email="invited@example.com")
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": new_user.email, "role": "member"}, format="json")
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert HouseholdMember.objects.filter(household=household, user=new_user).exists()

    def test_invite_nonexistent_user(self, owner_client, household):
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": "ghost@example.com", "role": "member"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_member_cannot_invite(self, db, household):
        member_user = UserFactory()
        HouseholdMember.objects.create(
            household=household, user=member_user, role=HouseholdMember.Role.MEMBER
        )
        invite_target = UserFactory()
        client = APIClient()
        client.force_authenticate(user=member_user)
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = client.post(url, {"email": invite_target.email, "role": "member"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

