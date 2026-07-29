"""Somebody joined the foyer — the foyer is told.

The invitation used to be a one-way street: the newcomer got a notification,
and nobody learned they had said yes. The counterpart is emitted from
`services.consume_invitation`, the single door every join path goes through
(the in-app accept, the shared link opened while logged in, and the link that
creates the account on the spot). Notifying from the views instead would mean
three call sites and a fourth one silently missing the day a path is added.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdInvitation, HouseholdMember
from notifications.models import Notification

JOINED = Notification.Type.HOUSEHOLD_MEMBER_JOINED


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def owner(db):
    return UserFactory(display_name="Alice")


@pytest.fixture
def newcomer(db):
    return UserFactory(display_name="Bob")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Maison Test")
    HouseholdMember.objects.create(household=h, user=owner, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def newcomer_client(newcomer):
    client = APIClient()
    client.force_authenticate(user=newcomer)
    return client


@pytest.fixture
def invitation(db, household, owner, newcomer):
    return HouseholdInvitation.objects.create(
        household=household,
        invited_user=newcomer,
        invited_by=owner,
        status=HouseholdInvitation.Status.PENDING,
    )


@pytest.fixture
def link(db, household, owner):
    """A pending invitation addressed to nobody in particular."""
    return HouseholdInvitation.objects.create(
        household=household,
        invited_by=owner,
        role=HouseholdMember.Role.MEMBER,
    )


def accept_url(invitation):
    return reverse("household-invitation-accept", kwargs={"pk": invitation.pk})


def join_url(invitation):
    return reverse("household-join", kwargs={"token": invitation.token})


def joined_notifications(user=None):
    qs = Notification.objects.filter(type=JOINED)
    return qs.filter(user=user) if user else qs


# ---------------------------------------------------------------------------
# The household hears about it, whichever door the newcomer came through
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestTheHouseholdIsToldSomebodyJoined:

    def test_accepting_an_invitation_notifies_the_inviter(
        self, newcomer_client, invitation, owner, newcomer, household
    ):
        newcomer_client.post(accept_url(invitation), {"switch": False}, format="json")

        notif = joined_notifications(owner).get()
        assert "Bob" in notif.title
        assert notif.payload["household_id"] == str(household.id)
        assert notif.payload["member_id"] == str(newcomer.id)
        assert notif.payload["member_name"] == "Bob"

    def test_opening_a_shared_link_while_logged_in_notifies_too(
        self, newcomer_client, link, owner, newcomer
    ):
        """The link path has no inviter waiting on an accept — and still counts."""
        newcomer_client.post(join_url(link), {}, format="json")

        assert joined_notifications(owner).count() == 1

    def test_joining_with_a_brand_new_account_notifies_too(self, link, owner):
        """The account is created on the spot; the household still learns of it."""
        APIClient().post(
            join_url(link),
            {"email": "claire@example.com", "password": "s3cret-passphrase!", "display_name": "Claire"},
            format="json",
        )

        notif = joined_notifications(owner).get()
        assert "Claire" in notif.title

    def test_every_member_is_notified_not_only_the_inviter(
        self, newcomer_client, invitation, household, owner
    ):
        """`invited_by` is nullable and a link is shareable by hand: joining is a
        fact the whole foyer reads, not a receipt for whoever clicked invite."""
        other = UserFactory(display_name="Chloé")
        HouseholdMember.objects.create(household=household, user=other)

        newcomer_client.post(accept_url(invitation), {"switch": False}, format="json")

        assert set(joined_notifications().values_list("user_id", flat=True)) == {owner.id, other.id}

    def test_the_newcomer_is_not_notified_of_their_own_arrival(
        self, newcomer_client, invitation, newcomer
    ):
        newcomer_client.post(accept_url(invitation), {"switch": False}, format="json")

        assert not joined_notifications(newcomer).exists()

    def test_members_of_another_household_hear_nothing(
        self, newcomer_client, invitation, owner
    ):
        stranger = UserFactory()
        elsewhere = Household.objects.create(name="Ailleurs")
        HouseholdMember.objects.create(household=elsewhere, user=stranger)

        newcomer_client.post(accept_url(invitation), {"switch": False}, format="json")

        assert not joined_notifications(stranger).exists()


# ---------------------------------------------------------------------------
# What must never break because of it
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestJoiningStaysCorrect:

    def test_a_missing_inviter_does_not_break_the_join(
        self, newcomer_client, invitation, household, owner, newcomer
    ):
        """`invited_by` is `SET_NULL`: the owner who invited may be long gone."""
        invitation.invited_by = None
        invitation.save(update_fields=["invited_by"])

        response = newcomer_client.post(accept_url(invitation), {"switch": False}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert HouseholdMember.objects.filter(household=household, user=newcomer).exists()
        assert joined_notifications(owner).count() == 1

    def test_a_link_reused_by_an_existing_member_notifies_nobody(
        self, newcomer_client, link, household, newcomer, owner
    ):
        """Re-opening a link is idempotent — and idempotent means no second
        announcement of an arrival that already happened."""
        HouseholdMember.objects.create(household=household, user=newcomer)

        response = newcomer_client.post(join_url(link), {}, format="json")

        assert response.data["already_member"] is True
        assert not joined_notifications().exists()

    def test_a_declined_invitation_announces_nothing(
        self, newcomer_client, invitation, owner
    ):
        url = reverse("household-invitation-decline", kwargs={"pk": invitation.pk})
        newcomer_client.post(url, {}, format="json")

        assert not joined_notifications().exists()

    def test_the_first_member_of_a_fresh_household_notifies_nobody(self, db, newcomer):
        """Nobody to tell is not an error — the loop simply has no recipient."""
        from households import services

        empty = Household.objects.create(name="Vide")
        invite = HouseholdInvitation.objects.create(household=empty, role=HouseholdMember.Role.OWNER)

        services.consume_invitation(invite, newcomer, switch=True)

        assert not joined_notifications().exists()


# ---------------------------------------------------------------------------
# One household, several languages
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestEachMemberReadsItInTheirOwnLanguage:
    """A household mixes locales. Rendering once with the joiner's language
    would post everyone the announcement in a language they may not read —
    the notification is stored as plain text, so there is no second chance."""

    def test_two_members_two_languages(self, newcomer_client, invitation, household, owner):
        owner.locale = "fr"
        owner.save(update_fields=["locale"])
        english = UserFactory(display_name="Dave", locale="en")
        HouseholdMember.objects.create(household=household, user=english)

        newcomer_client.post(accept_url(invitation), {"switch": False}, format="json")

        assert joined_notifications(owner).get().title != joined_notifications(english).get().title
        assert "rejoint" in joined_notifications(owner).get().title
