"""
Household invitation tests — invite flow, pending state, accept/decline.
"""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember, HouseholdInvitation
from notifications.models import Notification

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """Isolate `invitation_join` throttle state between tests.

    Throttles are live in the test settings and their history sits in a
    process-wide LocMemCache. Without this the anonymous join tests share one
    20/hour bucket, so adding a test would make an unrelated one 429 — and which
    one depends on execution order.
    """
    cache.clear()
    yield
    cache.clear()


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
        inv = HouseholdInvitation.objects.get(id=response.data["id"])
        assert inv.status == HouseholdInvitation.Status.PENDING
        assert inv.invited_user == invitee
        assert inv.household == household

    def test_invite_returns_a_shareable_link(self, owner_client, household, invitee):
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": invitee.email}, format="json")
        inv = HouseholdInvitation.objects.get(id=response.data["id"])
        assert response.data["join_url"].endswith(f"/join/{inv.token}")
        assert len(inv.token) >= 40

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
        assert notif.payload.get("invitation_id") == response.data["id"]

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

    def test_inviting_someone_without_an_account_still_creates_a_link(self, owner_client, household):
        """The regression that made the whole feature unusable in production.

        `invite` used to require an existing House account and answered 404 —
        while no signup existed anywhere in the app, so nobody could ever be in
        a position to be invited.
        """
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": "nobody@example.com"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        inv = HouseholdInvitation.objects.get(id=response.data["id"])
        assert inv.invited_user is None
        assert inv.email == "nobody@example.com"
        assert response.data["join_url"].endswith(f"/join/{inv.token}")

    def test_invite_without_any_email_creates_an_open_link(self, owner_client, household):
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        inv = HouseholdInvitation.objects.get(id=response.data["id"])
        assert inv.email == ""
        assert inv.invited_user is None

    def test_invite_matches_email_case_insensitively(self, owner_client, household, invitee):
        """`Jean@X.com` must find the account stored as `jean@x.com`.

        The exact-match lookup meant a single capital letter produced the same
        404 as a missing account, while login and password reset had always been
        case-insensitive.
        """
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": invitee.email.upper()}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        inv = HouseholdInvitation.objects.get(id=response.data["id"])
        assert inv.invited_user == invitee
        assert inv.email == invitee.email.lower()

    def test_invite_existing_member_rejected_whatever_the_case(self, owner_client, household, invitee):
        HouseholdMember.objects.create(household=household, user=invitee)
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": invitee.email.upper()}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_invite_error_detail_is_a_string_not_a_list(self, owner_client, household, invitee):
        """Every page reads `data.detail` as a string; a list prints as an array."""
        HouseholdMember.objects.create(household=household, user=invitee)
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": invitee.email}, format="json")
        assert isinstance(response.data["detail"], str)

    def test_invite_rejects_unknown_role(self, owner_client, household):
        url = reverse("household-invite", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"email": "x@example.com", "role": "admin"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

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


# ---------------------------------------------------------------------------
# GET/POST /api/households/join/{token}/ — the shared link
# ---------------------------------------------------------------------------

@pytest.fixture
def link(db, household, owner):
    """A pending invitation addressed to nobody in particular."""
    return HouseholdInvitation.objects.create(
        household=household,
        invited_by=owner,
        role=HouseholdMember.Role.MEMBER,
    )


def join_url(invitation):
    return reverse("household-join", kwargs={"token": invitation.token})


@pytest.mark.django_db
class TestPreviewInvitationLink:
    """An anonymous visitor learns what they are about to join."""

    def test_preview_needs_no_account(self, api_client, link, household, owner):
        response = api_client.get(join_url(link))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["household_name"] == household.name
        # `full_name`, la règle du modèle — la recomposer ici revenait à figer
        # la copie amputée que #546 a supprimée.
        assert response.data["invited_by_name"] == owner.full_name
        assert response.data["is_expired"] is False

    def test_preview_never_leaks_the_token(self, api_client, link):
        response = api_client.get(join_url(link))
        assert "token" not in response.data

    def test_unknown_token_is_404(self, api_client):
        response = api_client.get(reverse("household-join", kwargs={"token": "nope"}))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_revoked_link_discloses_nothing(self, api_client, link, household):
        """A revoked link must not even name the household to whoever still holds it."""
        link.status = HouseholdInvitation.Status.REVOKED
        link.save()
        response = api_client.get(join_url(link))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert household.name not in str(response.data)

    def test_used_link_discloses_nothing(self, api_client, link, invitee):
        link.status = HouseholdInvitation.Status.ACCEPTED
        link.save()
        assert api_client.get(join_url(link)).status_code == status.HTTP_404_NOT_FOUND

    def test_expired_link_says_expired_rather_than_invalid(self, api_client, link):
        """Actionable: the visitor knows to ask for a new link, not to doubt the URL."""
        link.expires_at = timezone.now() - timedelta(seconds=1)
        link.save()
        response = api_client.get(join_url(link))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_expired"] is True


@pytest.mark.django_db
class TestJoiningWithANewAccount:
    """The path that did not exist: no account, no signup page, no way in."""

    def test_join_creates_the_account_and_the_membership(self, api_client, link, household):
        response = api_client.post(
            join_url(link),
            {"email": "claire@example.com", "password": "un-mot-de-passe-solide", "display_name": "Claire"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email="claire@example.com")
        assert user.display_name == "Claire"
        assert HouseholdMember.objects.filter(household=household, user=user).exists()

    def test_join_logs_the_new_member_straight_in(self, api_client, link):
        """Otherwise joining ends on a login screen, retyping the password just chosen."""
        response = api_client.post(
            join_url(link),
            {"email": "claire@example.com", "password": "un-mot-de-passe-solide"},
            format="json",
        )
        assert response.data["access"]
        assert response.data["refresh"]

    def test_join_lands_on_the_household_it_joined(self, api_client, link, household):
        api_client.post(
            join_url(link),
            {"email": "claire@example.com", "password": "un-mot-de-passe-solide"},
            format="json",
        )
        user = User.objects.get(email="claire@example.com")
        assert user.active_household_id == household.id

    def test_join_consumes_the_link(self, api_client, link):
        api_client.post(
            join_url(link),
            {"email": "claire@example.com", "password": "un-mot-de-passe-solide"},
            format="json",
        )
        link.refresh_from_db()
        assert link.status == HouseholdInvitation.Status.ACCEPTED

    def test_a_link_cannot_be_used_twice(self, api_client, link):
        payload = {"email": "claire@example.com", "password": "un-mot-de-passe-solide"}
        api_client.post(join_url(link), payload, format="json")
        second = api_client.post(
            join_url(link),
            {"email": "someone-else@example.com", "password": "un-mot-de-passe-solide"},
            format="json",
        )
        assert second.status_code == status.HTTP_404_NOT_FOUND
        assert not User.objects.filter(email="someone-else@example.com").exists()

    def test_an_addressed_link_pins_the_email(self, api_client, household, owner):
        """A forwarded link must not open an account under a different address."""
        invitation = HouseholdInvitation.objects.create(
            household=household, invited_by=owner, email="claire@example.com",
        )
        api_client.post(
            join_url(invitation),
            {"email": "attacker@example.com", "password": "un-mot-de-passe-solide"},
            format="json",
        )
        assert User.objects.filter(email="claire@example.com").exists()
        assert not User.objects.filter(email="attacker@example.com").exists()

    def test_join_never_takes_over_an_existing_account(self, api_client, link, invitee, household):
        response = api_client.post(
            join_url(link),
            {"email": invitee.email, "password": "un-autre-mot-de-passe"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        invitee.refresh_from_db()
        assert not invitee.check_password("un-autre-mot-de-passe")
        assert not HouseholdMember.objects.filter(household=household, user=invitee).exists()
        # Still usable once they log in — a refusal must not burn the link.
        link.refresh_from_db()
        assert link.status == HouseholdInvitation.Status.PENDING

    def test_join_refuses_a_weak_password(self, api_client, link):
        response = api_client.post(
            join_url(link), {"email": "claire@example.com", "password": "1234"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert isinstance(response.data["detail"], str)
        assert not User.objects.filter(email="claire@example.com").exists()

    def test_join_needs_an_email_when_the_link_has_none(self, api_client, link):
        response = api_client.post(join_url(link), {"password": "un-mot-de-passe-solide"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_expired_link_cannot_be_joined(self, api_client, link):
        link.expires_at = timezone.now() - timedelta(seconds=1)
        link.save()
        response = api_client.post(
            join_url(link),
            {"email": "claire@example.com", "password": "un-mot-de-passe-solide"},
            format="json",
        )
        assert response.status_code == status.HTTP_410_GONE
        assert not User.objects.filter(email="claire@example.com").exists()


@pytest.mark.django_db
class TestJoiningWhileLoggedIn:
    """Somebody who already has an account opens the link."""

    def test_join_enrolls_the_current_user(self, invitee_client, link, invitee, household):
        response = invitee_client.post(join_url(link), {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["created_account"] is False
        assert HouseholdMember.objects.filter(household=household, user=invitee).exists()

    def test_join_honours_the_invited_role(self, invitee_client, household, owner, invitee):
        invitation = HouseholdInvitation.objects.create(
            household=household, invited_by=owner, role=HouseholdMember.Role.OWNER,
        )
        invitee_client.post(join_url(invitation), {}, format="json")
        membership = HouseholdMember.objects.get(household=household, user=invitee)
        assert membership.role == HouseholdMember.Role.OWNER

    def test_an_existing_member_is_told_so_rather_than_shown_an_error(
        self, invitee_client, link, invitee, household
    ):
        HouseholdMember.objects.create(household=household, user=invitee)
        response = invitee_client.post(join_url(link), {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["already_member"] is True


# ---------------------------------------------------------------------------
# Owner-side link management
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestOwnerManagesLinks:

    def test_owner_lists_pending_links_with_their_urls(self, owner_client, household, link):
        url = reverse("household-invitations", kwargs={"pk": household.pk})
        response = owner_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert [row["id"] for row in response.data] == [str(link.id)]
        assert response.data[0]["join_url"].endswith(f"/join/{link.token}")

    def test_revoked_links_are_not_listed(self, owner_client, household, link):
        link.status = HouseholdInvitation.Status.REVOKED
        link.save()
        response = owner_client.get(reverse("household-invitations", kwargs={"pk": household.pk}))
        assert response.data == []

    def test_owner_revokes_a_leaked_link(self, owner_client, api_client, household, link):
        url = reverse("household-revoke-invitation", kwargs={"pk": household.pk})
        response = owner_client.post(url, {"invitation_id": str(link.id)}, format="json")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        link.refresh_from_db()
        assert link.status == HouseholdInvitation.Status.REVOKED
        # And the link stops opening anything.
        assert api_client.get(join_url(link)).status_code == status.HTTP_404_NOT_FOUND

    def test_a_member_cannot_list_or_revoke_links(self, db, household, link):
        member = UserFactory()
        HouseholdMember.objects.create(household=household, user=member)
        client = APIClient()
        client.force_authenticate(user=member)
        listed = client.get(reverse("household-invitations", kwargs={"pk": household.pk}))
        revoked = client.post(
            reverse("household-revoke-invitation", kwargs={"pk": household.pk}),
            {"invitation_id": str(link.id)},
            format="json",
        )
        assert listed.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        assert revoked.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_an_owner_cannot_revoke_another_households_link(self, db, link):
        outsider = UserFactory()
        other = Household.objects.create(name="Elsewhere")
        HouseholdMember.objects.create(household=other, user=outsider, role=HouseholdMember.Role.OWNER)
        client = APIClient()
        client.force_authenticate(user=outsider)
        response = client.post(
            reverse("household-revoke-invitation", kwargs={"pk": other.pk}),
            {"invitation_id": str(link.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        link.refresh_from_db()
        assert link.status == HouseholdInvitation.Status.PENDING


@pytest.mark.django_db
class TestJoinIsThrottled:
    """The token is unguessable; the throttle caps account creation from one source."""

    def test_anonymous_joins_are_rate_limited(self, household, owner, monkeypatch):
        from households.throttles import InvitationJoinThrottle
        monkeypatch.setattr(InvitationJoinThrottle, "get_rate", lambda self: "3/hour")

        codes = []
        for i in range(5):
            invitation = HouseholdInvitation.objects.create(household=household, invited_by=owner)
            # A fresh client each time: joining logs the visitor in, and a
            # carried-over session cookie would make the next call authenticated
            # — which is precisely the path this throttle does not cover.
            codes.append(
                APIClient().post(
                    join_url(invitation),
                    {"email": f"person{i}@example.com", "password": "un-mot-de-passe-solide"},
                    format="json",
                ).status_code
            )

        assert codes[:3] == [status.HTTP_201_CREATED] * 3
        assert codes[3:] == [status.HTTP_429_TOO_MANY_REQUESTS] * 2

    def test_a_logged_in_member_joining_is_not_throttled(self, invitee_client, household, owner, monkeypatch):
        """Throttling the authenticated path would block a legitimate family member."""
        from households.throttles import InvitationJoinThrottle
        monkeypatch.setattr(InvitationJoinThrottle, "get_rate", lambda self: "1/hour")

        for _ in range(3):
            invitation = HouseholdInvitation.objects.create(household=household, invited_by=owner)
            response = invitee_client.post(join_url(invitation), {}, format="json")
            assert response.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# Garde-fous trouvés en revue de la PR #462
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestALinkNeverOutlivesWhatItOpens:
    """Trois trous que la première version du lien laissait ouverts."""

    def test_a_link_to_an_archived_household_opens_nothing(self, api_client, household, link):
        """`destroy` est un soft-delete : sans ce filtre le lien survivait au foyer.

        Et comme `HouseholdViewSet.get_queryset` masque les foyers archivés, la
        personne rejoignait un foyer qu'elle ne pourrait jamais voir.
        """
        household.archived_at = timezone.now()
        household.save(update_fields=["archived_at"])

        assert api_client.get(join_url(link)).status_code == status.HTTP_404_NOT_FOUND
        response = api_client.post(
            join_url(link),
            {"email": "claire@example.com", "password": "un-mot-de-passe-solide"},
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert not User.objects.filter(email="claire@example.com").exists()

    def test_an_addressed_link_is_pinned_for_a_logged_in_account_too(
        self, db, household, owner, invitee
    ):
        """L'épinglage valait pour le join anonyme seulement.

        Un lien adressé à Claire, transféré à quelqu'un qui a déjà un compte,
        enrôlait ce compte-là. Épingler d'un seul côté, c'est énoncer la règle
        entière et n'en tenir que la moitié.
        """
        invitation = HouseholdInvitation.objects.create(
            household=household, invited_by=owner, email="claire@example.com",
        )
        client = APIClient()
        client.force_authenticate(user=invitee)

        response = client.post(join_url(invitation), {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "claire@example.com" in response.data["detail"]
        assert not HouseholdMember.objects.filter(household=household, user=invitee).exists()
        # Et le refus ne brûle pas le lien : Claire peut encore s'en servir.
        invitation.refresh_from_db()
        assert invitation.status == HouseholdInvitation.Status.PENDING

    def test_the_invited_account_still_accepts_its_own_addressed_link(
        self, db, household, owner, invitee
    ):
        invitation = HouseholdInvitation.objects.create(
            household=household, invited_by=owner, email=invitee.email,
        )
        client = APIClient()
        client.force_authenticate(user=invitee)

        response = client.post(join_url(invitation), {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert HouseholdMember.objects.filter(household=household, user=invitee).exists()

    def test_a_link_enrolls_exactly_one_person_even_read_twice(self, db, household, link):
        """L'usage unique ne tenait pas sous concurrence.

        Deux requêtes simultanées résolvaient le token avant que l'une l'ait
        consommé, chacune voyait `pending`, et un `save()` aveugle laissait les
        deux aboutir — un seul lien pour deux membres. La revendication est
        maintenant un UPDATE conditionnel, que Postgres sérialise.
        """
        from households import services

        first = services.get_pending_invitation(link.token)
        second = services.get_pending_invitation(link.token)
        assert first is not None and second is not None

        winner, loser = UserFactory(), UserFactory()
        services.consume_invitation(first, winner)

        with pytest.raises(services.InvitationError):
            services.consume_invitation(second, loser)

        joined = HouseholdMember.objects.filter(household=household).exclude(role="owner")
        assert [m.user_id for m in joined] == [winner.id]
