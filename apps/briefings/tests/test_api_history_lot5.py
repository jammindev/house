"""REST API tests for Briefing Lot 5: send history endpoint + last_send glance.

Coverage:
1. last_send on BriefingSerializer — null when no send_logs; reflects most recent
   log's status/content/created_at when logs exist.
2. history endpoint (GET /api/briefings/briefings/<id>/history/) — newest-first,
   correct serializer fields, empty list on zero logs, ordering by -created_at.
3. history cap at HISTORY_PAGE_SIZE (30) — create 35 logs, assert only 30 returned.
4. Permissions on history:
   - creator of a private briefing can GET history (200);
   - a different member cannot GET history of a private briefing (404, hidden by queryset);
   - any member can GET history of a shared briefing (200);
   - anonymous → 401;
   - cross-household briefing id → 404.
5. Isolation: history only returns logs of THAT briefing (no cross-briefing leakage).
"""
import datetime
import uuid

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from briefings.models import Briefing, BriefingSendLog
from households.models import Household, HouseholdMember


# ── Shared helpers ────────────────────────────────────────────────────────────

def _make_user(email: str):
    return UserFactory(email=email)


def _make_household(name: str = "History House") -> Household:
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


# ── Module-level fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return _make_user("history-owner@test.dev")


@pytest.fixture
def household(db, owner):
    hh = _make_household("History House")
    _add_member(owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def member(db, household):
    user = _make_user("history-member@test.dev")
    _add_member(user, household, role=HouseholdMember.Role.MEMBER)
    return user


@pytest.fixture
def other_owner(db):
    return _make_user("history-other@test.dev")


@pytest.fixture
def other_household(db, other_owner):
    hh = _make_household("Other History House")
    _add_member(other_owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


# ── TestLastSendGlance ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLastSendGlance:
    """BriefingSerializer.last_send field — null or most-recent log summary.

    The list and retrieve endpoints both serialise the briefing with last_send.
    We exercise retrieve here to keep each test minimal.
    """

    def _create_briefing(self, household, user, **kwargs) -> Briefing:
        defaults = {"title": "Glance Test", "prompt": "Check me.", "is_private": False}
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def _create_log(self, briefing, user, household, **kwargs) -> BriefingSendLog:
        defaults = {
            "briefing": briefing,
            "user": user,
            "household": household,
            "slot_date": datetime.date(2026, 7, 1),
            "slot_time": datetime.time(8, 0),
            "status": BriefingSendLog.Status.SENT,
            "content": "Morning summary text.",
        }
        defaults.update(kwargs)
        return BriefingSendLog.objects.create(**defaults)

    def test_last_send_is_null_when_no_logs(self, owner, household):
        b = self._create_briefing(household, owner)
        client = _client_for(owner)
        response = client.get(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["last_send"] is None

    def test_last_send_reflects_only_log_status_and_content(self, owner, household):
        b = self._create_briefing(household, owner)
        log = self._create_log(
            b, owner, household, status=BriefingSendLog.Status.SENT, content="Hello world"
        )
        client = _client_for(owner)
        response = client.get(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        last = response.data["last_send"]
        assert last is not None
        assert last["status"] == BriefingSendLog.Status.SENT
        assert last["content"] == "Hello world"
        assert last["created_at"] is not None

    def test_last_send_reflects_most_recent_log(self, owner, household):
        """When there are multiple logs, last_send must be the newest."""
        b = self._create_briefing(household, owner)
        # Older log — different slot so uniqueness constraint is satisfied.
        self._create_log(
            b, owner, household,
            slot_date=datetime.date(2026, 7, 1),
            slot_time=datetime.time(7, 0),
            status=BriefingSendLog.Status.ERROR,
            content="",
        )
        # Newer log.
        newer = self._create_log(
            b, owner, household,
            slot_date=datetime.date(2026, 7, 2),
            slot_time=datetime.time(8, 0),
            status=BriefingSendLog.Status.SENT,
            content="Latest text",
        )
        client = _client_for(owner)
        response = client.get(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        last = response.data["last_send"]
        assert last["status"] == BriefingSendLog.Status.SENT
        assert last["content"] == "Latest text"
        # Verify created_at matches the newer log exactly.
        assert last["created_at"] == newer.created_at.isoformat()

    def test_last_send_status_skipped_condition(self, owner, household):
        b = self._create_briefing(household, owner)
        self._create_log(
            b, owner, household,
            status=BriefingSendLog.Status.SKIPPED_CONDITION,
            content="Weather is fine, skipping.",
        )
        client = _client_for(owner)
        response = client.get(reverse("briefing-detail", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        last = response.data["last_send"]
        assert last["status"] == BriefingSendLog.Status.SKIPPED_CONDITION
        assert last["content"] == "Weather is fine, skipping."

    def test_last_send_appears_on_list_endpoint(self, owner, household):
        """last_send is also present on the list response (not only retrieve)."""
        b = self._create_briefing(household, owner, title="List glance")
        self._create_log(b, owner, household, content="List check text")
        client = _client_for(owner)
        response = client.get(reverse("briefing-list"))
        assert response.status_code == status.HTTP_200_OK
        matching = [item for item in response.data if item["title"] == "List glance"]
        assert len(matching) == 1
        assert matching[0]["last_send"] is not None
        assert matching[0]["last_send"]["content"] == "List check text"


# ── TestHistoryEndpoint ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestHistoryEndpoint:
    """GET /api/briefings/briefings/<id>/history/ — happy-path and ordering."""

    def _create_briefing(self, household, user, **kwargs) -> Briefing:
        defaults = {"title": "History Test", "prompt": "Tell me.", "is_private": False}
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def _create_log(self, briefing, user, household, **kwargs) -> BriefingSendLog:
        defaults = {
            "briefing": briefing,
            "user": user,
            "household": household,
            "slot_date": datetime.date(2026, 7, 1),
            "slot_time": datetime.time(8, 0),
            "status": BriefingSendLog.Status.SENT,
            "content": "Log content.",
        }
        defaults.update(kwargs)
        return BriefingSendLog.objects.create(**defaults)

    def test_history_returns_200_for_owner(self, owner, household):
        b = self._create_briefing(household, owner)
        self._create_log(b, owner, household)
        client = _client_for(owner)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK

    def test_history_empty_list_when_no_logs(self, owner, household):
        b = self._create_briefing(household, owner)
        client = _client_for(owner)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_history_contains_expected_serializer_fields(self, owner, household):
        b = self._create_briefing(household, owner)
        self._create_log(
            b, owner, household,
            status=BriefingSendLog.Status.SENT,
            content="Morning report",
            slot_date=datetime.date(2026, 7, 10),
            slot_time=datetime.time(9, 0),
        )
        client = _client_for(owner)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        item = response.data[0]
        assert "id" in item
        assert item["status"] == BriefingSendLog.Status.SENT
        assert item["content"] == "Morning report"
        assert str(item["slot_date"]) == "2026-07-10"
        assert str(item["slot_time"]) == "09:00:00"
        assert "user" in item
        assert "user_name" in item
        assert "created_at" in item

    def test_history_user_name_matches_recipient(self, owner, household):
        b = self._create_briefing(household, owner)
        self._create_log(b, owner, household)
        client = _client_for(owner)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        item = response.data[0]
        assert item["user_name"] == owner.full_name

    def test_history_ordered_newest_first(self, owner, household):
        """Logs must come back in -created_at order (slot dates used to force ordering)."""
        b = self._create_briefing(household, owner)
        # Create three logs on distinct slots so the uniqueness constraint is satisfied.
        log_old = self._create_log(
            b, owner, household,
            slot_date=datetime.date(2026, 7, 1),
            slot_time=datetime.time(8, 0),
            content="Oldest",
        )
        log_mid = self._create_log(
            b, owner, household,
            slot_date=datetime.date(2026, 7, 2),
            slot_time=datetime.time(8, 0),
            content="Middle",
        )
        log_new = self._create_log(
            b, owner, household,
            slot_date=datetime.date(2026, 7, 3),
            slot_time=datetime.time(8, 0),
            content="Newest",
        )
        client = _client_for(owner)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3
        contents = [item["content"] for item in response.data]
        # Newest (latest created_at) must be first.
        assert contents[0] == "Newest"
        assert contents[-1] == "Oldest"

    def test_history_cap_at_30(self, owner, household):
        """create 35 logs; history must return exactly 30 (HISTORY_PAGE_SIZE)."""
        b = self._create_briefing(household, owner)
        for i in range(35):
            BriefingSendLog.objects.create(
                briefing=b,
                user=owner,
                household=household,
                slot_date=datetime.date(2026, 7, 1),
                slot_time=datetime.time(i % 24, i // 24),
                status=BriefingSendLog.Status.SENT,
                content=f"Log {i}",
            )
        client = _client_for(owner)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 30


# ── TestHistoryIsolation ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestHistoryIsolation:
    """History must only include logs for the requested briefing — no cross-briefing leakage."""

    def _create_briefing(self, household, user, **kwargs) -> Briefing:
        defaults = {"title": "Isolation Test", "prompt": "Isolated.", "is_private": False}
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def _create_log(self, briefing, user, household, **kwargs) -> BriefingSendLog:
        defaults = {
            "briefing": briefing,
            "user": user,
            "household": household,
            "slot_date": datetime.date(2026, 7, 1),
            "slot_time": datetime.time(8, 0),
            "status": BriefingSendLog.Status.SENT,
            "content": "Isolation log.",
        }
        defaults.update(kwargs)
        return BriefingSendLog.objects.create(**defaults)

    def test_history_does_not_include_other_briefings_logs(self, owner, household):
        b1 = self._create_briefing(household, owner, title="Briefing A")
        b2 = self._create_briefing(household, owner, title="Briefing B")
        self._create_log(b1, owner, household, content="Log for A")
        self._create_log(b2, owner, household, content="Log for B")
        client = _client_for(owner)
        # Request history for b1 only — must not include b2's log.
        response = client.get(reverse("briefing-history", args=[str(b1.pk)]))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["content"] == "Log for A"

    def test_history_does_not_include_logs_from_other_household(
        self, owner, household, other_owner, other_household
    ):
        """A briefing from another household cannot be accessed — 404 gates access."""
        foreign_b = self._create_briefing(other_household, other_owner, title="Foreign B")
        self._create_log(foreign_b, other_owner, other_household, content="Foreign log")
        client = _client_for(owner)
        response = client.get(reverse("briefing-history", args=[str(foreign_b.pk)]))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── TestHistoryPermissions ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestHistoryPermissions:
    """Permission matrix for the history endpoint."""

    def _create_briefing(self, household, user, **kwargs) -> Briefing:
        defaults = {"title": "Perm Test", "prompt": "Permissioned.", "is_private": False}
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def _create_log(self, briefing, user, household, **kwargs) -> BriefingSendLog:
        defaults = {
            "briefing": briefing,
            "user": user,
            "household": household,
            "slot_date": datetime.date(2026, 7, 1),
            "slot_time": datetime.time(8, 0),
            "status": BriefingSendLog.Status.SENT,
            "content": "Perm log.",
        }
        defaults.update(kwargs)
        return BriefingSendLog.objects.create(**defaults)

    def test_creator_can_get_history_of_own_private_briefing(self, owner, household):
        b = self._create_briefing(household, owner, is_private=True)
        self._create_log(b, owner, household)
        client = _client_for(owner)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_other_member_cannot_get_history_of_private_briefing(
        self, member, owner, household
    ):
        """Private briefing excluded from member queryset → 404."""
        b = self._create_briefing(household, owner, is_private=True)
        self._create_log(b, owner, household)
        client = _client_for(member)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_member_can_get_history_of_shared_briefing(self, member, owner, household):
        """Any household member may GET history of a shared briefing."""
        b = self._create_briefing(household, owner, is_private=False)
        self._create_log(b, owner, household)
        client = _client_for(member)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK

    def test_anonymous_gets_401(self, owner, household):
        b = self._create_briefing(household, owner)
        self._create_log(b, owner, household)
        response = _anon_client().get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_returns_404(self, owner, household, other_owner, other_household):
        foreign = self._create_briefing(other_household, other_owner)
        self._create_log(foreign, other_owner, other_household)
        client = _client_for(owner)
        response = client.get(reverse("briefing-history", args=[str(foreign.pk)]))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_member_can_get_history_of_own_private_briefing(self, member, household):
        """A member's own private briefing is visible to themselves."""
        b = self._create_briefing(household, member, is_private=True)
        self._create_log(b, member, household)
        client = _client_for(member)
        response = client.get(reverse("briefing-history", args=[str(b.pk)]))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
