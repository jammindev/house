"""REST API tests for BriefingViewSet (/api/briefings/briefings/).

Coverage:
1. Happy-path CRUD — create (201), list (200), retrieve (200), patch (200), delete (204).
2. DB state verification after every mutation.
3. Permission checks — owner, member, anonymous (401), non-member (404).
4. Cross-household isolation — another household's briefings are invisible.
5. Validation errors — missing title, missing prompt → 400 with field key.
6. Visibility filtering — private briefings are hidden from other members.
7. Object-level permissions:
   - Private briefing: only creator can retrieve/patch/delete (other member → 404 on retrieve,
     403 on write).
   - Shared briefing: non-creator member cannot edit/delete (403); household owner can (200/204).
8. Service/REST create equivalence — same validations are triggered via both paths.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from briefings.models import Briefing
from briefings.services import MAX_ACTIVE_BRIEFINGS_PER_USER
from households.models import Household, HouseholdMember


# ── Shared helpers ────────────────────────────────────────────────────────────

def _make_user(email: str):
    return UserFactory(email=email)


def _make_household(name: str = "Test House") -> Household:
    return Household.objects.create(name=name)


def _add_member(user, household, role=HouseholdMember.Role.OWNER) -> HouseholdMember:
    """Add user to household and set it as their active household."""
    membership = HouseholdMember.objects.create(user=user, household=household, role=role)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return membership


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _anon_client() -> APIClient:
    return APIClient()


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return _make_user("briefing-api-owner@test.dev")


@pytest.fixture
def household(db, owner):
    hh = _make_household("Briefing House")
    _add_member(owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def member(db, household):
    user = _make_user("briefing-api-member@test.dev")
    _add_member(user, household, role=HouseholdMember.Role.MEMBER)
    return user


@pytest.fixture
def other_owner(db):
    return _make_user("briefing-api-other@test.dev")


@pytest.fixture
def other_household(db, other_owner):
    hh = _make_household("Other Briefing House")
    _add_member(other_owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


# ── TestBriefingList ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBriefingList:
    """GET /api/briefings/briefings/ — household-scoped list."""

    def _create_briefing(self, household, user, **kwargs) -> Briefing:
        defaults = {"title": "My brief", "prompt": "Tell me something.", "is_private": False}
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def _briefing_payload(self, **overrides):
        return {"title": "New brief", "prompt": "Daily summary.", **overrides}

    def test_owner_can_list_own_briefings(self, owner, household):
        self._create_briefing(household, owner, title="Alpha")
        self._create_briefing(household, owner, title="Beta")
        client = _client_for(owner)
        response = client.get(reverse("briefing-list"))
        assert response.status_code == status.HTTP_200_OK
        titles = [b["title"] for b in response.data]
        assert "Alpha" in titles
        assert "Beta" in titles

    def test_member_can_list_shared_briefings(self, member, household, owner):
        self._create_briefing(household, owner, title="Shared brief", is_private=False)
        client = _client_for(member)
        response = client.get(reverse("briefing-list"))
        assert response.status_code == status.HTTP_200_OK
        titles = [b["title"] for b in response.data]
        assert "Shared brief" in titles

    def test_anonymous_gets_401(self, household, owner):
        self._create_briefing(household, owner)
        response = _anon_client().get(reverse("briefing-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_briefings_not_visible(self, owner, household, other_owner, other_household):
        self._create_briefing(other_household, other_owner, title="Foreign brief")
        self._create_briefing(household, owner, title="My brief")
        client = _client_for(owner)
        response = client.get(reverse("briefing-list"))
        assert response.status_code == status.HTTP_200_OK
        titles = [b["title"] for b in response.data]
        assert "Foreign brief" not in titles
        assert "My brief" in titles

    def test_private_briefing_hidden_from_other_member(self, owner, member, household):
        """A private briefing by the owner must NOT appear in another member's list."""
        self._create_briefing(household, owner, title="Owner secret", is_private=True)
        client = _client_for(member)
        response = client.get(reverse("briefing-list"))
        assert response.status_code == status.HTTP_200_OK
        titles = [b["title"] for b in response.data]
        assert "Owner secret" not in titles

    def test_own_private_briefing_visible_to_creator(self, owner, household):
        self._create_briefing(household, owner, title="My private", is_private=True)
        client = _client_for(owner)
        response = client.get(reverse("briefing-list"))
        assert response.status_code == status.HTTP_200_OK
        titles = [b["title"] for b in response.data]
        assert "My private" in titles

    def test_member_own_private_briefing_visible(self, member, household):
        """A member's own private briefing appears only in their list, not in others'."""
        Briefing.objects.create(
            household=household, created_by=member, title="Member secret",
            prompt="Private stuff.", is_private=True
        )
        client = _client_for(member)
        response = client.get(reverse("briefing-list"))
        assert response.status_code == status.HTTP_200_OK
        titles = [b["title"] for b in response.data]
        assert "Member secret" in titles


# ── TestBriefingCreate ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBriefingCreate:
    """POST /api/briefings/briefings/ — create a new briefing."""

    def _briefing_payload(self, **overrides):
        return {"title": "Morning brief", "prompt": "What's new today?", **overrides}

    def test_owner_can_create_briefing(self, owner, household):
        client = _client_for(owner)
        payload = self._briefing_payload()
        response = client.post(reverse("briefing-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "Morning brief"
        assert response.data["prompt"] == "What's new today?"

    def test_created_by_set_to_request_user(self, owner, household):
        client = _client_for(owner)
        response = client.post(reverse("briefing-list"), self._briefing_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        briefing = Briefing.objects.get(pk=response.data["id"])
        assert briefing.created_by == owner

    def test_household_scoped_to_active_household(self, owner, household):
        client = _client_for(owner)
        response = client.post(reverse("briefing-list"), self._briefing_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        briefing = Briefing.objects.get(pk=response.data["id"])
        assert briefing.household == household

    def test_db_state_after_create(self, owner, household):
        client = _client_for(owner)
        payload = self._briefing_payload(
            title="DB check", prompt="Verify me.", is_private=True, is_active=False
        )
        response = client.post(reverse("briefing-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        briefing = Briefing.objects.get(pk=response.data["id"])
        assert briefing.title == "DB check"
        assert briefing.is_private is True
        assert briefing.is_active is False
        assert briefing.household == household

    def test_member_can_create_briefing(self, member, household):
        client = _client_for(member)
        response = client.post(reverse("briefing-list"), self._briefing_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        briefing = Briefing.objects.get(pk=response.data["id"])
        assert briefing.created_by == member
        assert briefing.household == household

    def test_anonymous_cannot_create(self, household):
        response = _anon_client().post(
            reverse("briefing-list"), self._briefing_payload(), format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_title_returns_400(self, owner, household):
        client = _client_for(owner)
        response = client.post(
            reverse("briefing-list"), {"prompt": "No title here."}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "title" in response.data

    def test_blank_title_returns_400(self, owner, household):
        client = _client_for(owner)
        response = client.post(
            reverse("briefing-list"), {"title": "   ", "prompt": "Blank title."}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "title" in response.data

    def test_missing_prompt_returns_400(self, owner, household):
        client = _client_for(owner)
        response = client.post(
            reverse("briefing-list"), {"title": "No prompt"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prompt" in response.data

    def test_blank_prompt_returns_400(self, owner, household):
        client = _client_for(owner)
        response = client.post(
            reverse("briefing-list"), {"title": "Good", "prompt": ""}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "prompt" in response.data

    def test_create_defaults_is_active_false(self, owner, household):
        client = _client_for(owner)
        response = client.post(reverse("briefing-list"), self._briefing_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["is_active"] is False

    def test_create_defaults_is_private_false(self, owner, household):
        client = _client_for(owner)
        response = client.post(reverse("briefing-list"), self._briefing_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["is_private"] is False

    def test_create_at_quota_returns_400(self, owner, household):
        """11th active briefing via REST must return 400 with is_active in the error."""
        for i in range(MAX_ACTIVE_BRIEFINGS_PER_USER):
            Briefing.objects.create(
                household=household, created_by=owner,
                title=f"Active {i}", prompt=".", is_active=True
            )
        client = _client_for(owner)
        payload = self._briefing_payload(title="Overflow", is_active=True)
        response = client.post(reverse("briefing-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_active" in response.data


# ── TestBriefingRetrieve ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBriefingRetrieve:
    """GET /api/briefings/briefings/<id>/ — single briefing retrieval."""

    def _create_briefing(self, household, user, **kwargs) -> Briefing:
        defaults = {"title": "Retrieve me", "prompt": "Content.", "is_private": False}
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def _briefing_payload(self, **overrides):
        return {"title": "Retrieve me", "prompt": "Content.", **overrides}

    def test_owner_can_retrieve_shared_briefing(self, owner, household):
        b = self._create_briefing(household, owner)
        client = _client_for(owner)
        response = client.get(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["id"]) == str(b.pk)

    def test_member_can_retrieve_shared_briefing(self, member, household, owner):
        b = self._create_briefing(household, owner, is_private=False)
        client = _client_for(member)
        response = client.get(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK

    def test_member_cannot_retrieve_owners_private_briefing(self, member, household, owner):
        """A private briefing is excluded from the queryset → 404 for non-creator."""
        b = self._create_briefing(household, owner, is_private=True)
        client = _client_for(member)
        response = client.get(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_anonymous_gets_401(self, owner, household):
        b = self._create_briefing(household, owner)
        response = _anon_client().get(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_retrieve_returns_404(self, owner, household, other_owner, other_household):
        foreign = self._create_briefing(other_household, other_owner, title="Foreign")
        client = _client_for(owner)
        response = client.get(reverse("briefing-detail", args=[str(foreign.pk)]))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── TestBriefingUpdate ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBriefingUpdate:
    """PATCH /api/briefings/briefings/<id>/ — partial update."""

    def _create_briefing(self, household, user, **kwargs) -> Briefing:
        defaults = {"title": "Original", "prompt": "Original prompt.", "is_private": False}
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def _briefing_payload(self, **overrides):
        return {"title": "Updated", **overrides}

    def test_owner_can_patch_title(self, owner, household):
        b = self._create_briefing(household, owner)
        client = _client_for(owner)
        response = client.patch(
            reverse("briefing-detail", args=[str(b.pk)]),
            {"title": "New title"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        b.refresh_from_db()
        assert b.title == "New title"

    def test_db_state_after_patch(self, owner, household):
        b = self._create_briefing(household, owner)
        client = _client_for(owner)
        client.patch(
            reverse("briefing-detail", args=[str(b.pk)]),
            {"title": "Persisted title", "is_private": True},
            format="json",
        )
        b.refresh_from_db()
        assert b.title == "Persisted title"
        assert b.is_private is True

    def test_member_cannot_patch_shared_briefing_created_by_owner(self, member, owner, household):
        """Non-creator members cannot edit a shared briefing (only owners can)."""
        b = self._create_briefing(household, owner, is_private=False)
        client = _client_for(member)
        response = client.patch(
            reverse("briefing-detail", args=[str(b.pk)]),
            {"title": "Hijacked"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        b.refresh_from_db()
        assert b.title == "Original"

    def test_household_owner_can_patch_shared_briefing_not_created_by_them(self, owner, household):
        """A household owner (role=owner) can edit a shared briefing they did not create."""
        co_owner = _make_user("briefing-coowner@test.dev")
        _add_member(co_owner, household, role=HouseholdMember.Role.OWNER)
        b = self._create_briefing(household, co_owner, is_private=False)
        # owner did not create b, but is a household owner.
        client = _client_for(owner)
        response = client.patch(
            reverse("briefing-detail", args=[str(b.pk)]),
            {"title": "Owner edited"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        b.refresh_from_db()
        assert b.title == "Owner edited"

    def test_member_cannot_patch_private_briefing_from_another_member(self, member, owner, household):
        """Private briefing by owner is excluded from member's queryset → 404."""
        b = self._create_briefing(household, owner, is_private=True)
        client = _client_for(member)
        response = client.patch(
            reverse("briefing-detail", args=[str(b.pk)]),
            {"title": "Hacked"},
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_anonymous_cannot_patch(self, owner, household):
        b = self._create_briefing(household, owner)
        response = _anon_client().patch(
            reverse("briefing-detail", args=[str(b.pk)]),
            {"title": "Anon"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_patch_returns_404(self, owner, household, other_owner, other_household):
        foreign = self._create_briefing(other_household, other_owner, title="Foreign")
        client = _client_for(owner)
        response = client.patch(
            reverse("briefing-detail", args=[str(foreign.pk)]),
            {"title": "Hijacked"},
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        foreign.refresh_from_db()
        assert foreign.title == "Foreign"

    def test_blank_title_patch_returns_400(self, owner, household):
        b = self._create_briefing(household, owner)
        client = _client_for(owner)
        response = client.patch(
            reverse("briefing-detail", args=[str(b.pk)]),
            {"title": ""},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "title" in response.data

    def test_turning_on_at_quota_returns_400(self, owner, household):
        """PATCH that flips is_active=True when quota full must return 400."""
        for i in range(MAX_ACTIVE_BRIEFINGS_PER_USER):
            Briefing.objects.create(
                household=household, created_by=owner,
                title=f"Active {i}", prompt=".", is_active=True
            )
        b = self._create_briefing(household, owner, is_active=False)
        client = _client_for(owner)
        response = client.patch(
            reverse("briefing-detail", args=[str(b.pk)]),
            {"is_active": True},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_active" in response.data


# ── TestBriefingDelete ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBriefingDelete:
    """DELETE /api/briefings/briefings/<id>/ — deletion."""

    def _create_briefing(self, household, user, **kwargs) -> Briefing:
        defaults = {"title": "To delete", "prompt": "Gone soon.", "is_private": False}
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def _briefing_payload(self, **overrides):
        return {"title": "To delete", "prompt": "Gone soon.", **overrides}

    def test_creator_can_delete_shared_briefing(self, owner, household):
        b = self._create_briefing(household, owner)
        pk = b.pk
        client = _client_for(owner)
        response = client.delete(reverse("briefing-detail", args=[str(pk)]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Briefing.objects.filter(pk=pk).exists()

    def test_creator_can_delete_private_briefing(self, owner, household):
        b = self._create_briefing(household, owner, is_private=True)
        pk = b.pk
        client = _client_for(owner)
        response = client.delete(reverse("briefing-detail", args=[str(pk)]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Briefing.objects.filter(pk=pk).exists()

    def test_member_cannot_delete_shared_briefing_owned_by_another(self, member, owner, household):
        b = self._create_briefing(household, owner, is_private=False)
        client = _client_for(member)
        response = client.delete(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert Briefing.objects.filter(pk=b.pk).exists()

    def test_household_owner_can_delete_shared_briefing_not_created_by_them(self, owner, household):
        co_owner = _make_user("briefing-del-coowner@test.dev")
        _add_member(co_owner, household, role=HouseholdMember.Role.OWNER)
        b = self._create_briefing(household, co_owner, is_private=False)
        pk = b.pk
        client = _client_for(owner)
        response = client.delete(reverse("briefing-detail", args=[str(pk)]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Briefing.objects.filter(pk=pk).exists()

    def test_member_cannot_delete_private_briefing_from_owner(self, member, owner, household):
        """Private briefing is excluded from queryset — member gets 404."""
        b = self._create_briefing(household, owner, is_private=True)
        client = _client_for(member)
        response = client.delete(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert Briefing.objects.filter(pk=b.pk).exists()

    def test_anonymous_cannot_delete(self, owner, household):
        b = self._create_briefing(household, owner)
        response = _anon_client().delete(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert Briefing.objects.filter(pk=b.pk).exists()

    def test_cross_household_delete_returns_404(self, owner, household, other_owner, other_household):
        foreign = self._create_briefing(other_household, other_owner, title="Foreign")
        client = _client_for(owner)
        response = client.delete(reverse("briefing-detail", args=[str(foreign.pk)]))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert Briefing.objects.filter(pk=foreign.pk).exists()


# ── TestBriefingServiceRestEquivalence ────────────────────────────────────────

@pytest.mark.django_db
class TestBriefingServiceRestEquivalence:
    """Verify REST create and service create_briefing share the same validation path."""

    def _briefing_payload(self, **overrides):
        return {"title": "Check", "prompt": "Equivalent.", **overrides}

    def test_rest_and_service_both_reject_empty_title(self, owner, household):
        from rest_framework import serializers as drf_serializers
        from briefings.services import create_briefing

        # REST path.
        client = _client_for(owner)
        rest_resp = client.post(
            reverse("briefing-list"), {"title": "", "prompt": "Valid."}, format="json"
        )
        assert rest_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "title" in rest_resp.data

        # Service path.
        with pytest.raises(drf_serializers.ValidationError) as exc_info:
            create_briefing(household, owner, title="", prompt="Valid.")
        assert "title" in exc_info.value.detail

    def test_rest_and_service_both_reject_empty_prompt(self, owner, household):
        from rest_framework import serializers as drf_serializers
        from briefings.services import create_briefing

        # REST path.
        client = _client_for(owner)
        rest_resp = client.post(
            reverse("briefing-list"), {"title": "Good", "prompt": ""}, format="json"
        )
        assert rest_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "prompt" in rest_resp.data

        # Service path.
        with pytest.raises(drf_serializers.ValidationError) as exc_info:
            create_briefing(household, owner, title="Good", prompt="")
        assert "prompt" in exc_info.value.detail

    def test_rest_and_service_both_enforce_quota(self, owner, household):
        """Both write paths raise/return a 400 on the 11th active briefing."""
        from rest_framework import serializers as drf_serializers
        from briefings.services import create_briefing

        for i in range(MAX_ACTIVE_BRIEFINGS_PER_USER):
            Briefing.objects.create(
                household=household, created_by=owner,
                title=f"Seed {i}", prompt=".", is_active=True
            )

        # REST path.
        client = _client_for(owner)
        rest_resp = client.post(
            reverse("briefing-list"),
            {"title": "Overflow", "prompt": "Too many.", "is_active": True},
            format="json",
        )
        assert rest_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_active" in rest_resp.data

        # Service path.
        with pytest.raises(drf_serializers.ValidationError) as exc_info:
            create_briefing(household, owner, title="Overflow svc", prompt=".", is_active=True)
        assert "is_active" in exc_info.value.detail
