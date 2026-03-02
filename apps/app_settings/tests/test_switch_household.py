# app_settings/tests/test_switch_household.py
import json
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from households.models import HouseholdMember

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _post_switch(client, household_id, **extra):
    return client.post(
        reverse("app_settings_switch_household"),
        data=json.dumps({"household_id": str(household_id)}),
        content_type="application/json",
        **extra,
    )


# ---------------------------------------------------------------------------
# switch_household_view
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_switch_household_sets_active_on_user(client):
    user = UserFactory()
    h1 = HouseholdFactory()
    h2 = HouseholdFactory()
    HouseholdMemberFactory(household=h1, user=user)
    HouseholdMemberFactory(household=h2, user=user)

    client.force_login(user)
    response = _post_switch(client, h2.id)

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["activeHouseholdId"] == str(h2.id)
    user.refresh_from_db()
    assert user.active_household_id == h2.id


@pytest.mark.django_db
def test_switch_household_can_change_again(client):
    user = UserFactory()
    h1 = HouseholdFactory()
    h2 = HouseholdFactory()
    HouseholdMemberFactory(household=h1, user=user)
    HouseholdMemberFactory(household=h2, user=user)

    client.force_login(user)
    _post_switch(client, h1.id)
    _post_switch(client, h2.id)

    user.refresh_from_db()
    assert user.active_household_id == h2.id


@pytest.mark.django_db
def test_switch_household_forbidden_for_non_member(client):
    user = UserFactory()
    other_household = HouseholdFactory()
    # user has no membership in other_household

    client.force_login(user)
    response = _post_switch(client, other_household.id)

    assert response.status_code == 403
    user.refresh_from_db()
    assert user.active_household_id is None


@pytest.mark.django_db
def test_switch_household_returns_400_without_household_id(client):
    user = UserFactory()
    client.force_login(user)

    response = client.post(
        reverse("app_settings_switch_household"),
        data=json.dumps({}),
        content_type="application/json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_switch_household_returns_400_for_invalid_json(client):
    user = UserFactory()
    client.force_login(user)

    response = client.post(
        reverse("app_settings_switch_household"),
        data="not-json",
        content_type="application/json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_switch_household_requires_login(client):
    household = HouseholdFactory()

    response = _post_switch(client, household.id)

    assert response.status_code == 302
    assert "login" in response["Location"]


@pytest.mark.django_db
def test_switch_household_rejects_get(client):
    user = UserFactory()
    client.force_login(user)

    response = client.get(reverse("app_settings_switch_household"))

    assert response.status_code == 405


# ---------------------------------------------------------------------------
# Signal: auto-set active_household on first join
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_signal_sets_active_household_on_first_membership():
    user = UserFactory()
    assert user.active_household_id is None

    household = HouseholdFactory()
    HouseholdMemberFactory(household=household, user=user)

    user.refresh_from_db()
    assert user.active_household_id == household.id


@pytest.mark.django_db
def test_signal_does_not_override_existing_active_household():
    user = UserFactory()
    h1 = HouseholdFactory()
    h2 = HouseholdFactory()
    HouseholdMemberFactory(household=h1, user=user)
    # h1 is now active — creating h2 membership must NOT override it
    HouseholdMemberFactory(household=h2, user=user)

    user.refresh_from_db()
    assert user.active_household_id == h1.id


@pytest.mark.django_db
def test_signal_clears_active_household_on_leave():
    user = UserFactory()
    h1 = HouseholdFactory()
    HouseholdMember.objects.create(household=h1, user=user, role=HouseholdMember.Role.MEMBER)
    user.refresh_from_db()
    assert user.active_household_id == h1.id

    HouseholdMember.objects.filter(household=h1, user=user).delete()

    user.refresh_from_db()
    assert user.active_household_id is None


@pytest.mark.django_db
def test_signal_picks_other_household_on_leave():
    user = UserFactory()
    h1 = HouseholdFactory()
    h2 = HouseholdFactory()
    HouseholdMember.objects.create(household=h1, user=user, role=HouseholdMember.Role.MEMBER)
    HouseholdMember.objects.create(household=h2, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household_id = h1.id
    user.save(update_fields=['active_household_id'])

    HouseholdMember.objects.filter(household=h1, user=user).delete()

    user.refresh_from_db()
    assert user.active_household_id == h2.id


# ---------------------------------------------------------------------------
# app_settings_view — activeHouseholdId in context
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_settings_view_exposes_active_household_id(client):
    user = UserFactory()
    h = HouseholdFactory()
    HouseholdMemberFactory(household=h, user=user)
    user.active_household_id = h.id
    user.save(update_fields=['active_household_id'])

    client.force_login(user)
    response = client.get(reverse("app_settings"))

    assert response.status_code == 200
    assert response.context["settings_props"]["activeHouseholdId"] == str(h.id)


@pytest.mark.django_db
def test_settings_view_active_household_id_none_when_not_set(client):
    user = UserFactory()
    client.force_login(user)
    response = client.get(reverse("app_settings"))

    assert response.status_code == 200
    assert response.context["settings_props"]["activeHouseholdId"] is None


# ---------------------------------------------------------------------------
# resolve_request_household — user.active_household priority
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_resolve_uses_active_household_field(rf):
    from core.permissions import resolve_request_household

    user = UserFactory()
    h1 = HouseholdFactory()
    h2 = HouseholdFactory()
    HouseholdMemberFactory(household=h1, user=user)
    HouseholdMemberFactory(household=h2, user=user)
    user.active_household_id = h2.id
    user.save(update_fields=['active_household_id'])

    request = rf.get("/")
    request.user = user

    resolved = resolve_request_household(request)
    assert resolved is not None
    assert resolved.id == h2.id


@pytest.mark.django_db
def test_resolve_header_overrides_active_household(rf):
    from core.permissions import resolve_request_household

    user = UserFactory()
    h1 = HouseholdFactory()
    h2 = HouseholdFactory()
    HouseholdMemberFactory(household=h1, user=user)
    HouseholdMemberFactory(household=h2, user=user)
    user.active_household_id = h2.id
    user.save(update_fields=['active_household_id'])

    request = rf.get("/", HTTP_X_HOUSEHOLD_ID=str(h1.id))
    request.user = user

    resolved = resolve_request_household(request)
    assert resolved is not None
    assert resolved.id == h1.id


# ---------------------------------------------------------------------------
# Integration: API create/invite → signal → active_household
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_create_household_via_api_sets_active():
    """POST /api/households/ → membership created → signal auto-sets active_household."""
    from rest_framework.test import APIClient
    from django.urls import reverse as drf_reverse

    user = UserFactory()
    assert user.active_household_id is None

    api = APIClient()
    api.force_authenticate(user=user)
    response = api.post(drf_reverse("household-list"), {"name": "My House"}, format="json")

    assert response.status_code == 201
    h_id = response.data["id"]

    user.refresh_from_db()
    assert str(user.active_household_id) == str(h_id)


@pytest.mark.django_db
def test_invite_via_api_sets_active_for_new_member():
    """Invite → pending invitation; accept (no switch) → active_household auto-set when user had none."""
    from rest_framework.test import APIClient
    from django.urls import reverse as drf_reverse

    owner = UserFactory()
    invited = UserFactory()
    assert invited.active_household_id is None

    # Owner creates a household
    api_owner = APIClient()
    api_owner.force_authenticate(user=owner)
    resp = api_owner.post(drf_reverse("household-list"), {"name": "Owner House"}, format="json")
    assert resp.status_code == 201
    h_id = resp.data["id"]

    # Owner invites the other user → creates a pending invitation, no membership yet
    invite_url = drf_reverse("household-invite", kwargs={"pk": h_id})
    resp2 = api_owner.post(invite_url, {"email": invited.email, "role": "member"}, format="json")
    assert resp2.status_code == 201
    invitation_id = resp2.data["invitation_id"]

    # Invite does NOT set active_household
    invited.refresh_from_db()
    assert invited.active_household_id is None

    # Invited user accepts (without explicit switch) → auto-set because they had no active household
    api_invited = APIClient()
    api_invited.force_authenticate(user=invited)
    accept_url = drf_reverse("household-invitation-accept", kwargs={"pk": invitation_id})
    resp3 = api_invited.post(accept_url, {"switch": False}, format="json")
    assert resp3.status_code == 200

    invited.refresh_from_db()
    assert str(invited.active_household_id) == str(h_id)


@pytest.mark.django_db
def test_invite_via_api_does_not_override_existing_active():
    """Invited user who already has an active_household keeps it after being added to another."""
    from rest_framework.test import APIClient
    from django.urls import reverse as drf_reverse

    owner = UserFactory()
    invited = UserFactory()

    # Give invited user an existing active household
    existing_h = HouseholdFactory()
    HouseholdMemberFactory(household=existing_h, user=invited)
    invited.active_household_id = existing_h.id
    invited.save(update_fields=["active_household_id"])

    # Owner creates a new household and invites the user
    api_owner = APIClient()
    api_owner.force_authenticate(user=owner)
    resp = api_owner.post(drf_reverse("household-list"), {"name": "Second House"}, format="json")
    assert resp.status_code == 201
    new_h_id = resp.data["id"]

    invite_url = drf_reverse("household-invite", kwargs={"pk": new_h_id})
    resp2 = api_owner.post(invite_url, {"email": invited.email, "role": "member"}, format="json")
    assert resp2.status_code == 201

    invited.refresh_from_db()
    # Still points to the original household
    assert invited.active_household_id == existing_h.id
