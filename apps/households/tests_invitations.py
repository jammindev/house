"""
Household invitation tests — invite flow, pending state, accept/decline.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember, HouseholdInvitation
from notifications.models import Notification


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner(db):
    return UserFactory()


@pytest.fixture
def invitee(db):
    return UserFactory()


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Test House")
    HouseholdMember.objects.create(household=h, user=owner, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


@pytest.fixture
def invitee_client(invitee):
    client = APIClient()
    client.force_authenticate(user=invitee)
    return client


# ---------------------------------------------------------------------------
# POST /api/households/{id}/invite/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestInviteAction:
    """Owner invites a user — creates a pending HouseholdInvitation."""

    def test_invite_creates_pending_invitation(self, owner_client, household, invitee):
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": invitee.email}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert "invitation_id" in response.data
        inv = HouseholdInvitation.objects.get(id=response.data["invitation_id"])
        assert inv.status == HouseholdInvitation.Status.PENDING
        assert inv.invited_user == invitee
        assert inv.household == household

    def test_invite_does_not_add_member_directly(self, owner_client, household, invitee):
        url = reverse("household-invite", kwargs={"pk": household.pk})
        owner_client.post(url, {"email": invitee.email}, format="json")
        assert not HouseholdMember.objects.filter(household=household, user=invitee).exists()

    def test_invite_creates_notification_with_invitation_id(self, owner_client, household, invitee):
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": invitee.email}, format="json")
        notif = Notification.objects.filter(
            user=invitee, type="household_invitation"
        ).first()
        assert notif is not None
        assert notif.payload.get("invitation_id") == response.data["invitation_id"]

    def test_double_invite_rejected(self, owner_client, household, invitee):
        url = reverse("household-invite", kwargs={"pk": household.pk})
        owner_client.post(url, {"email": invitee.email}, format="json")
        response = owner_client.post(url, {"email": invitee.email}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_invite_existing_member_rejected(self, owner_client, household, invitee):
        HouseholdMember.objects.create(household=household, user=invitee)
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": invitee.email}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_invite_nonexistent_email_returns_404(self, owner_client, household):
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": "nobody@example.com"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_member_cannot_invite(self, db, household, invitee):
        member = UserFactory()
        HouseholdMember.objects.create(household=household, user=member)
        client = APIClient()
        client.force_authenticate(user=member)
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = client.post(url, {"email": invitee.email}, format="json")
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# GET /api/households/invitations/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListInvitations:
    """Invitee can list their own pending invitations."""

    def test_list_returns_pending_invitations(self, db, invitee_client, invitee, household, owner):
        HouseholdInvitation.objects.create(
            household=household, invited_user=invitee, invited_by=owner,
            status=HouseholdInvitation.Status.PENDING,
        )
        url = reverse("household-invitation-list")
        response = invitee_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.data if isinstance(response.data, list) else response.data.get("results", [])
        assert len(data) == 1

    def test_accepted_invitations_not_listed(self, db, invitee_client, invitee, household, owner):
        HouseholdInvitation.objects.create(
            household=household, invited_user=invitee, invited_by=owner,
            status=HouseholdInvitation.Status.ACCEPTED,
        )
        url = reverse("household-invitation-list")
        response = invitee_client.get(url)
        data = response.data if isinstance(response.data, list) else response.data.get("results", [])
        assert len(data) == 0

    def test_cannot_see_other_users_invitations(self, db, invitee_client, household, owner):
        other = UserFactory()
        HouseholdInvitation.objects.create(
            household=household, invited_user=other, invited_by=owner,
            status=HouseholdInvitation.Status.PENDING,
        )
        url = reverse("household-invitation-list")
        response = invitee_client.get(url)
        data = response.data if isinstance(response.data, list) else response.data.get("results", [])
        assert len(data) == 0


# ---------------------------------------------------------------------------
# POST /api/households/invitations/{id}/accept/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAcceptInvitation:
    """Invitee accepts → HouseholdMember created, status accepted."""

    def setup_invitation(self, db, invitee, household, owner):
        return HouseholdInvitation.objects.create(
            household=household, invited_user=invitee, invited_by=owner,
            status=HouseholdInvitation.Status.PENDING,
        )

    def test_accept_creates_membership(self, db, invitee_client, invitee, household, owner):
        inv = self.setup_invitation(db, invitee, household, owner)
        url = reverse("household-invitation-accept", kwargs={"pk": inv.pk})
        response = invitee_client.post(url, {"switch": False}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert HouseholdMember.objects.filter(household=household, user=invitee).exists()
        inv.refresh_from_db()
        assert inv.status == HouseholdInvitation.Status.ACCEPTED

    def test_accept_switch_updates_active_household(self, db, invitee_client, invitee, household, owner):
        inv = self.setup_invitation(db, invitee, household, owner)
        url = reverse("household-invitation-accept", kwargs={"pk": inv.pk})
        response = invitee_client.post(url, {"switch": True}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["switched"] is True
        invitee.refresh_from_db()
        assert str(invitee.active_household_id) == str(household.id)

    def test_accept_marks_notification_read(self, db, invitee_client, invitee, household, owner):
        inv = self.setup_invitation(db, invitee, household, owner)
        notif = Notification.objects.create(
            user=invitee,
            type="household_invitation",
            title="Invite",
            payload={"invitation_id": str(inv.id)},
        )
        url = reverse("household-invitation-accept", kwargs={"pk": inv.pk})
        invitee_client.post(url, {"switch": False}, format="json")
        notif.refresh_from_db()
        assert notif.is_read is True

    def test_accept_already_accepted_rejected(self, db, invitee_client, invitee, household, owner):
        inv = self.setup_invitation(db, invitee, household, owner)
        inv.status = HouseholdInvitation.Status.ACCEPTED
        inv.save()
        url = reverse("household-invitation-accept", kwargs={"pk": inv.pk})
        response = invitee_client.post(url, {}, format="json")
        # Already accepted → not in pending queryset → 404
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_other_user_cannot_accept(self, db, invitee, household, owner):
        inv = self.setup_invitation(db, invitee, household, owner)
        other = UserFactory()
        client = APIClient()
        client.force_authenticate(user=other)
        url = reverse("household-invitation-accept", kwargs={"pk": inv.pk})
        response = client.post(url, {}, format="json")
        # invitation not in queryset → 404
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# POST /api/households/invitations/{id}/decline/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDeclineInvitation:
    """Invitee declines → no membership, status declined."""

    def setup_invitation(self, db, invitee, household, owner):
        return HouseholdInvitation.objects.create(
            household=household, invited_user=invitee, invited_by=owner,
            status=HouseholdInvitation.Status.PENDING,
        )

    def test_decline_does_not_create_membership(self, db, invitee_client, invitee, household, owner):
        inv = self.setup_invitation(db, invitee, household, owner)
        url = reverse("household-invitation-decline", kwargs={"pk": inv.pk})
        response = invitee_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert not HouseholdMember.objects.filter(household=household, user=invitee).exists()
        inv.refresh_from_db()
        assert inv.status == HouseholdInvitation.Status.DECLINED

    def test_decline_marks_notification_read(self, db, invitee_client, invitee, household, owner):
        inv = self.setup_invitation(db, invitee, household, owner)
        notif = Notification.objects.create(
            user=invitee,
            type="household_invitation",
            title="Invite",
            payload={"invitation_id": str(inv.id)},
        )
        url = reverse("household-invitation-decline", kwargs={"pk": inv.pk})
        invitee_client.post(url, {}, format="json")
        notif.refresh_from_db()
        assert notif.is_read is True

    def test_decline_already_declined_rejected(self, db, invitee_client, invitee, household, owner):
        inv = self.setup_invitation(db, invitee, household, owner)
        inv.status = HouseholdInvitation.Status.DECLINED
        inv.save()
        url = reverse("household-invitation-decline", kwargs={"pk": inv.pk})
        response = invitee_client.post(url, {}, format="json")
        # Already declined → not in pending queryset → 404
        assert response.status_code == status.HTTP_404_NOT_FOUND
