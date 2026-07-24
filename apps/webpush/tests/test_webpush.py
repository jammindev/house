from types import SimpleNamespace
from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from webpush.models import WebPushSubscription
from webpush.service import send_web_push


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(email="webpush@test.com", password="pass")


@pytest.fixture
def other_user(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(email="webpush-other@test.com", password="pass")


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def vapid(settings):
    settings.VAPID_PUBLIC_KEY = "test-public-key"
    settings.VAPID_PRIVATE_KEY = "test-private-key"
    settings.VAPID_ADMIN_EMAIL = "admin@test.com"
    return settings


def _sub_payload(endpoint="https://push.example.com/abc"):
    return {"endpoint": endpoint, "keys": {"p256dh": "p256dh-key", "auth": "auth-key"}}


# --- subscribe / unsubscribe ------------------------------------------------


@pytest.mark.django_db
def test_subscribe_creates_subscription(user, auth_client):
    response = auth_client.post("/api/webpush/subscribe/", _sub_payload(), format="json")

    assert response.status_code == status.HTTP_201_CREATED
    sub = WebPushSubscription.objects.get(user=user)
    assert sub.endpoint == "https://push.example.com/abc"
    assert sub.p256dh == "p256dh-key"
    assert sub.auth == "auth-key"


@pytest.mark.django_db
def test_subscribe_is_idempotent_by_endpoint(user, auth_client):
    auth_client.post("/api/webpush/subscribe/", _sub_payload(), format="json")
    payload = _sub_payload()
    payload["keys"]["p256dh"] = "rotated-key"
    second = auth_client.post("/api/webpush/subscribe/", payload, format="json")

    assert second.status_code == status.HTTP_200_OK
    assert WebPushSubscription.objects.filter(user=user).count() == 1
    assert WebPushSubscription.objects.get(user=user).p256dh == "rotated-key"


@pytest.mark.django_db
def test_unsubscribe_removes_only_own(user, other_user, auth_client):
    auth_client.post("/api/webpush/subscribe/", _sub_payload("https://push/mine"), format="json")
    WebPushSubscription.objects.create(
        user=other_user, endpoint="https://push/theirs", p256dh="k", auth="a"
    )

    response = auth_client.post(
        "/api/webpush/unsubscribe/", {"endpoint": "https://push/mine"}, format="json"
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not WebPushSubscription.objects.filter(user=user).exists()
    assert WebPushSubscription.objects.filter(user=other_user).exists()


@pytest.mark.django_db
def test_endpoints_require_authentication():
    anon = APIClient()
    assert anon.post("/api/webpush/subscribe/", _sub_payload(), format="json").status_code in (
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    )
    assert anon.get("/api/webpush/vapid-public-key/").status_code in (
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    )


@pytest.mark.django_db
def test_vapid_public_key_returned(auth_client, vapid):
    response = auth_client.get("/api/webpush/vapid-public-key/")
    assert response.status_code == status.HTTP_200_OK
    assert response.data["publicKey"] == "test-public-key"


# --- service: send_web_push -------------------------------------------------


@pytest.mark.django_db
def test_send_web_push_noop_without_config(user, settings):
    settings.VAPID_PRIVATE_KEY = ""
    settings.VAPID_ADMIN_EMAIL = ""
    WebPushSubscription.objects.create(
        user=user, endpoint="https://push/x", p256dh="k", auth="a"
    )

    with patch("pywebpush.webpush") as mock_push:
        sent = send_web_push(user, "Hi", "body")

    assert sent == 0
    mock_push.assert_not_called()


@pytest.mark.django_db
def test_send_web_push_delivers_and_stamps(user, vapid):
    sub = WebPushSubscription.objects.create(
        user=user, endpoint="https://push/x", p256dh="k", auth="a"
    )

    with patch("pywebpush.webpush") as mock_push:
        sent = send_web_push(user, "Hi", "body", url="/app/dashboard")

    assert sent == 1
    mock_push.assert_called_once()
    sub.refresh_from_db()
    assert sub.last_success_at is not None


@pytest.mark.django_db
def test_send_web_push_prunes_dead_subscription(user, vapid):
    from pywebpush import WebPushException

    WebPushSubscription.objects.create(
        user=user, endpoint="https://push/gone", p256dh="k", auth="a"
    )
    dead = WebPushException("gone", response=SimpleNamespace(status_code=410, text="gone"))

    with patch("pywebpush.webpush", side_effect=dead):
        sent = send_web_push(user, "Hi", "body")

    assert sent == 0
    assert not WebPushSubscription.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_send_web_push_keeps_sub_on_transient_error(user, vapid):
    from pywebpush import WebPushException

    WebPushSubscription.objects.create(
        user=user, endpoint="https://push/flaky", p256dh="k", auth="a"
    )
    transient = WebPushException("boom", response=SimpleNamespace(status_code=500, text="boom"))

    with patch("pywebpush.webpush", side_effect=transient):
        sent = send_web_push(user, "Hi", "body")

    assert sent == 0
    assert WebPushSubscription.objects.filter(user=user).exists()  # not pruned


@pytest.mark.django_db
def test_test_endpoint_reports_sent_count(user, auth_client, vapid):
    WebPushSubscription.objects.create(
        user=user, endpoint="https://push/x", p256dh="k", auth="a"
    )

    with patch("pywebpush.webpush") as mock_push:
        response = auth_client.post("/api/webpush/test/", {}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["sent"] == 1
    mock_push.assert_called_once()
