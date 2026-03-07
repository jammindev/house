import pytest
from rest_framework import status
from rest_framework.test import APIClient

from notifications.models import Notification
from notifications.service import create_notification


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model
    return get_user_model().objects.create_user(email="notif-extra@test.com", password="pass")


@pytest.fixture
def other_user(db):
    from django.contrib.auth import get_user_model
    return get_user_model().objects.create_user(email="notif-extra-other@test.com", password="pass")


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_deleted_notifications_are_hidden_from_list_and_count(user, auth_client):
    visible = create_notification(user, "household_invitation", "Visible")
    hidden = create_notification(user, "household_invitation", "Hidden")
    hidden.deleted_at = hidden.created_at
    hidden.save(update_fields=["deleted_at"])

    list_response = auth_client.get("/api/notifications/")
    count_response = auth_client.get("/api/notifications/unread-count/")

    assert list_response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in list_response.data] == [str(visible.id)]
    assert count_response.data["count"] == 1


@pytest.mark.django_db
def test_mark_all_read_only_affects_current_user(user, other_user, auth_client):
    create_notification(user, "household_invitation", "Mine")
    other_notification = create_notification(other_user, "household_invitation", "Other")

    response = auth_client.post("/api/notifications/mark-all-read/")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert Notification.objects.filter(user=user, is_read=False).count() == 0
    other_notification.refresh_from_db()
    assert other_notification.is_read is False
