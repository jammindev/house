import pytest
from rest_framework.test import APIClient
from rest_framework import status

from households.models import Household, HouseholdMember
from notifications.models import Notification
from notifications.service import create_notification


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(email="user@test.com", password="pass")


@pytest.fixture
def other_user(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(email="other@test.com", password="pass")


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestCreateNotification:
    def test_creates_notification(self, db, user):
        notif = create_notification(user, "household_invitation", "Test title")
        assert notif.pk is not None
        assert notif.user == user
        assert not notif.is_read

    def test_default_payload_is_empty_dict(self, db, user):
        notif = create_notification(user, "household_invitation", "T")
        assert notif.payload == {}

    def test_payload_stored(self, db, user):
        notif = create_notification(user, "household_invitation", "T", payload={"household_id": "abc"})
        assert notif.payload["household_id"] == "abc"


class TestNotificationAPI:
    def test_list_own_notifications(self, db, user, other_user, auth_client):
        create_notification(user, "household_invitation", "Mine")
        create_notification(other_user, "household_invitation", "Not mine")
        res = auth_client.get("/api/notifications/")
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data) == 1

    def test_unread_count(self, db, user, auth_client):
        create_notification(user, "household_invitation", "A")
        create_notification(user, "household_invitation", "B")
        res = auth_client.get("/api/notifications/unread-count/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["count"] == 2

    def test_mark_read(self, db, user, auth_client):
        notif = create_notification(user, "household_invitation", "A")
        res = auth_client.post(f"/api/notifications/{notif.id}/mark-read/")
        assert res.status_code == status.HTTP_204_NO_CONTENT
        notif.refresh_from_db()
        assert notif.is_read
        assert notif.read_at is not None

    def test_mark_all_read(self, db, user, auth_client):
        create_notification(user, "household_invitation", "A")
        create_notification(user, "household_invitation", "B")
        res = auth_client.post("/api/notifications/mark-all-read/")
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert Notification.objects.filter(user=user, is_read=False).count() == 0

    def test_cannot_see_other_user_notification(self, db, user, other_user, auth_client):
        notif = create_notification(other_user, "household_invitation", "Not mine")
        res = auth_client.get(f"/api/notifications/{notif.id}/")
        assert res.status_code == status.HTTP_404_NOT_FOUND


class TestInviteCreatesNotification:
    def test_notification_created_on_invite(self, db):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        owner = User.objects.create_user(email="owner@test.com", password="pass")
        invitee = User.objects.create_user(email="invitee@test.com", password="pass")
        household = Household.objects.create(name="TestHouse")
        HouseholdMember.objects.create(household=household, user=owner, role=HouseholdMember.Role.OWNER)

        client = APIClient()
        client.force_authenticate(user=owner)
        res = client.post(
            f"/api/households/{household.id}/invite/",
            {"email": invitee.email, "role": "member"},
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        notif = Notification.objects.filter(user=invitee, type="household_invitation").first()
        assert notif is not None
        assert notif.payload["household_id"] == str(household.id)
