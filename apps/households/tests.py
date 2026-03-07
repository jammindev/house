"""Household API tests — verifies SC-004: multi-tenant household operations."""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember, HouseholdInvitation


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

    def test_create_with_location_fields(self, owner_client):
        url = reverse("household-list")
        payload = {
            "name": "Full House",
            "address": "12 rue de la Paix",
            "city": "Paris",
            "postal_code": "75001",
            "country": "FR",
            "timezone": "Europe/Paris",
        }
        response = owner_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data
        assert data["postal_code"] == "75001"
        assert data["country"] == "FR"
        assert data["timezone"] == "Europe/Paris"

    def test_update_location_fields(self, owner_client, household):
        url = reverse("household-detail", kwargs={"pk": household.pk})
        response = owner_client.patch(
            url,
            {"postal_code": "69001", "country": "FR", "timezone": "Europe/Paris"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        household.refresh_from_db()
        assert household.postal_code == "69001"
        assert household.country == "FR"
        assert household.timezone == "Europe/Paris"

    def test_country_max_length(self, owner_client):
        """country must be ISO 3166-1 alpha-2 (max 2 chars)."""
        url = reverse("household-list")
        response = owner_client.post(
            url, {"name": "X", "country": "TOOLONG"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestListHouseholds:
    """GET /api/households/ — includes current role for UI action gating."""

    def test_list_includes_current_user_role(self, owner_client, household):
        list_url = reverse("household-list")
        response = owner_client.get(list_url)

        assert response.status_code == status.HTTP_200_OK
        payload_by_id = {item["id"]: item for item in response.data}
        assert str(household.id) in payload_by_id
        assert payload_by_id[str(household.id)]["current_user_role"] == HouseholdMember.Role.OWNER
        assert payload_by_id[str(household.id)]["members"][0]["role"] == HouseholdMember.Role.OWNER


@pytest.mark.django_db
class TestArchiveHousehold:
    """DELETE /api/households/{id}/ — owner can archive (soft-delete)."""

    def test_owner_can_archive(self, owner_client, household):
        url = reverse("household-detail", kwargs={"pk": household.pk})
        response = owner_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        # Record still exists but is archived
        household.refresh_from_db()
        assert household.archived_at is not None

    def test_archived_household_hidden_from_list(self, owner_client, household):
        # Archive it
        url = reverse("household-detail", kwargs={"pk": household.pk})
        owner_client.delete(url)
        # Should not appear in list
        list_url = reverse("household-list")
        response = owner_client.get(list_url)
        assert response.status_code == status.HTTP_200_OK
        ids = [h["id"] for h in response.data]
        assert str(household.pk) not in ids

    def test_member_cannot_archive(self, db, household):
        member_user = UserFactory()
        HouseholdMember.objects.create(
            household=household, user=member_user, role=HouseholdMember.Role.MEMBER
        )
        client = APIClient()
        client.force_authenticate(user=member_user)
        url = reverse("household-detail", kwargs={"pk": household.pk})
        response = client.delete(url)
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        # Record untouched
        household.refresh_from_db()
        assert household.archived_at is None


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
        # Invite now creates a pending invitation, NOT a direct membership
        assert HouseholdInvitation.objects.filter(
            household=household, invited_user=new_user, status=HouseholdInvitation.Status.PENDING
        ).exists()
        assert not HouseholdMember.objects.filter(household=household, user=new_user).exists()

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


@pytest.mark.django_db
class TestHouseholdMembersAction:
    def test_members_returns_all_household_members(self, owner_client, household, user):
        member_user = UserFactory(email="member-list@example.com")
        HouseholdMember.objects.create(
            household=household,
            user=member_user,
            role=HouseholdMember.Role.MEMBER,
        )

        url = reverse("household-members", kwargs={"pk": household.pk})
        response = owner_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        emails = {item["user_email"] for item in response.data}
        assert user.email in emails
        assert member_user.email in emails


@pytest.mark.django_db
class TestRemoveMemberAction:
    def test_owner_can_remove_member(self, owner_client, household):
        member_user = UserFactory(email="member-remove@example.com")
        HouseholdMember.objects.create(
            household=household,
            user=member_user,
            role=HouseholdMember.Role.MEMBER,
        )

        url = reverse("household-remove-member", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"user_id": str(member_user.id)}, format="json")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not HouseholdMember.objects.filter(household=household, user=member_user).exists()

    def test_remove_member_requires_user_id(self, owner_client, household):
        url = reverse("household-remove-member", kwargs={"pk": household.pk})
        response = owner_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_remove_last_owner(self, owner_client, household, user):
        url = reverse("household-remove-member", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"user_id": str(user.id)}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert HouseholdMember.objects.filter(household=household, user=user).exists()

    def test_member_cannot_remove_other_member(self, db, household):
        member_user = UserFactory(email="member-remove-denied@example.com")
        target_user = UserFactory(email="member-remove-target@example.com")
        HouseholdMember.objects.create(
            household=household,
            user=member_user,
            role=HouseholdMember.Role.MEMBER,
        )
        HouseholdMember.objects.create(
            household=household,
            user=target_user,
            role=HouseholdMember.Role.MEMBER,
        )
        client = APIClient()
        client.force_authenticate(user=member_user)

        url = reverse("household-remove-member", kwargs={"pk": household.pk})
        response = client.post(url, {"user_id": str(target_user.id)}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert HouseholdMember.objects.filter(household=household, user=target_user).exists()


@pytest.mark.django_db
class TestUpdateRoleAction:
    def test_owner_can_promote_member_to_owner(self, owner_client, household):
        member_user = UserFactory(email="promote@example.com")
        membership = HouseholdMember.objects.create(
            household=household,
            user=member_user,
            role=HouseholdMember.Role.MEMBER,
        )

        url = reverse("household-update-role", kwargs={"pk": household.pk})
        response = owner_client.post(
            url,
            {"user_id": str(member_user.id), "role": HouseholdMember.Role.OWNER},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        membership.refresh_from_db()
        assert membership.role == HouseholdMember.Role.OWNER

    def test_update_role_requires_user_id_and_role(self, owner_client, household):
        url = reverse("household-update-role", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"user_id": ""}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_role_rejects_invalid_role(self, owner_client, household):
        member_user = UserFactory(email="invalid-role@example.com")
        HouseholdMember.objects.create(
            household=household,
            user=member_user,
            role=HouseholdMember.Role.MEMBER,
        )

        url = reverse("household-update-role", kwargs={"pk": household.pk})
        response = owner_client.post(
            url,
            {"user_id": str(member_user.id), "role": "admin"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_demote_last_owner(self, owner_client, household, user):
        url = reverse("household-update-role", kwargs={"pk": household.pk})
        response = owner_client.post(
            url,
            {"user_id": str(user.id), "role": HouseholdMember.Role.MEMBER},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_member_cannot_update_roles(self, db, household):
        member_user = UserFactory(email="member-role@example.com")
        target_user = UserFactory(email="member-role-target@example.com")
        HouseholdMember.objects.create(
            household=household,
            user=member_user,
            role=HouseholdMember.Role.MEMBER,
        )
        HouseholdMember.objects.create(
            household=household,
            user=target_user,
            role=HouseholdMember.Role.MEMBER,
        )
        client = APIClient()
        client.force_authenticate(user=member_user)

        url = reverse("household-update-role", kwargs={"pk": household.pk})
        response = client.post(
            url,
            {"user_id": str(target_user.id), "role": HouseholdMember.Role.OWNER},
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestHouseholdMembershipSignals:
    def test_join_sets_active_household_when_user_has_none(self):
        user = UserFactory(email="signal-join@example.com")
        household = Household.objects.create(name="Signal Join")

        HouseholdMember.objects.create(
            household=household,
            user=user,
            role=HouseholdMember.Role.MEMBER,
        )

        user.refresh_from_db()
        assert user.active_household == household

    def test_join_does_not_override_existing_active_household(self):
        user = UserFactory(email="signal-keep@example.com")
        first_household = Household.objects.create(name="Signal First")
        second_household = Household.objects.create(name="Signal Second")
        HouseholdMember.objects.create(
            household=first_household,
            user=user,
            role=HouseholdMember.Role.MEMBER,
        )

        HouseholdMember.objects.create(
            household=second_household,
            user=user,
            role=HouseholdMember.Role.MEMBER,
        )

        user.refresh_from_db()
        assert user.active_household == first_household

    def test_leave_active_household_switches_to_another_membership(self):
        user = UserFactory(email="signal-switch@example.com")
        first_household = Household.objects.create(name="Signal Leave First")
        second_household = Household.objects.create(name="Signal Leave Second")
        first_membership = HouseholdMember.objects.create(
            household=first_household,
            user=user,
            role=HouseholdMember.Role.MEMBER,
        )
        HouseholdMember.objects.create(
            household=second_household,
            user=user,
            role=HouseholdMember.Role.MEMBER,
        )
        user.active_household = first_household
        user.save(update_fields=["active_household"])

        first_membership.delete()

        user.refresh_from_db()
        assert user.active_household == second_household

    def test_leaving_non_active_household_keeps_current_active_household(self):
        user = UserFactory(email="signal-noop@example.com")
        first_household = Household.objects.create(name="Signal Noop First")
        second_household = Household.objects.create(name="Signal Noop Second")
        HouseholdMember.objects.create(
            household=first_household,
            user=user,
            role=HouseholdMember.Role.MEMBER,
        )
        second_membership = HouseholdMember.objects.create(
            household=second_household,
            user=user,
            role=HouseholdMember.Role.MEMBER,
        )
        user.active_household = first_household
        user.save(update_fields=["active_household"])

        second_membership.delete()

        user.refresh_from_db()
        assert user.active_household == first_household

    def test_leave_last_active_household_clears_active_household(self):
        user = UserFactory(email="signal-clear@example.com")
        household = Household.objects.create(name="Signal Clear")
        membership = HouseholdMember.objects.create(
            household=household,
            user=user,
            role=HouseholdMember.Role.MEMBER,
        )
        user.active_household = household
        user.save(update_fields=["active_household"])

        membership.delete()

        user.refresh_from_db()
        assert user.active_household is None

