"""Service-layer tests for briefings.services.

Coverage:
1. create_briefing — happy path, title/prompt required, quota enforcement.
2. update_briefing — turning is_active on respects quota (excludes self), field edits persist.
3. delete_briefing — removes the instance from DB.
4. resolve_briefing — household-scoped lookup returns instance or None.
5. Quota isolation — another user's active briefings do not count toward the caller's quota.
"""
from datetime import time

import pytest
from rest_framework import serializers as drf_serializers

from accounts.tests.factories import UserFactory
from briefings.models import Briefing
from briefings.services import (
    MAX_ACTIVE_BRIEFINGS_PER_USER,
    create_briefing,
    delete_briefing,
    resolve_briefing,
    update_briefing,
)
from households.models import Household, HouseholdMember


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(email: str):
    return UserFactory(email=email)


def _make_household(name: str = "Services House") -> Household:
    return Household.objects.create(name=name)


def _add_member(user, household, role=HouseholdMember.Role.OWNER) -> HouseholdMember:
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _fill_quota(household, user, count=MAX_ACTIVE_BRIEFINGS_PER_USER):
    """Directly create `count` active briefings for user (bypassing service quota check)."""
    for i in range(count):
        Briefing.objects.create(
            household=household,
            created_by=user,
            title=f"Active briefing {i}",
            prompt="Daily summary.",
            is_active=True,
        )


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return _make_user("services-owner@test.dev")


@pytest.fixture
def household(db, owner):
    hh = _make_household("Services House")
    _add_member(owner, hh)
    owner.active_household = hh
    owner.save(update_fields=["active_household"])
    return hh


# ── TestCreateBriefingService ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateBriefingService:
    """create_briefing — validation and quota guard."""

    def test_happy_path_creates_and_returns_briefing(self, household, owner):
        b = create_briefing(household, owner, title="Morning brief", prompt="What's new?")
        assert b.pk is not None
        assert b.title == "Morning brief"
        assert b.prompt == "What's new?"
        assert b.household == household
        assert b.created_by == owner
        # Defaults
        assert b.is_active is False
        assert b.is_private is False
        assert b.briefing_type == Briefing.Type.RECURRING

    def test_db_state_after_create(self, household, owner):
        b = create_briefing(household, owner, title="DB verify", prompt="Check.")
        from_db = Briefing.objects.get(pk=b.pk)
        assert from_db.title == "DB verify"
        assert from_db.household_id == household.pk
        assert from_db.created_by_id == owner.pk

    def test_empty_title_raises_validation_error(self, household, owner):
        with pytest.raises(drf_serializers.ValidationError) as exc_info:
            create_briefing(household, owner, title="", prompt="Valid prompt.")
        assert "title" in exc_info.value.detail

    def test_whitespace_title_raises_validation_error(self, household, owner):
        with pytest.raises(drf_serializers.ValidationError) as exc_info:
            create_briefing(household, owner, title="   ", prompt="Valid prompt.")
        assert "title" in exc_info.value.detail

    def test_empty_prompt_raises_validation_error(self, household, owner):
        with pytest.raises(drf_serializers.ValidationError) as exc_info:
            create_briefing(household, owner, title="Good title", prompt="")
        assert "prompt" in exc_info.value.detail

    def test_condition_is_trimmed(self, household, owner):
        b = create_briefing(
            household, owner, title="Cond brief", prompt="Weather.", condition="  sunny  "
        )
        assert b.condition == "sunny"

    def test_11th_active_briefing_raises_validation_error(self, household, owner):
        _fill_quota(household, owner)
        with pytest.raises(drf_serializers.ValidationError) as exc_info:
            create_briefing(household, owner, title="One too many", prompt="Overflow.", is_active=True)
        assert "is_active" in exc_info.value.detail

    def test_user_at_quota_can_still_create_inactive_briefing(self, household, owner):
        _fill_quota(household, owner)
        # Should not raise — inactive briefings are not quota-capped.
        b = create_briefing(household, owner, title="Parked brief", prompt="Not yet.", is_active=False)
        assert b.pk is not None
        assert b.is_active is False

    def test_quota_is_per_user_other_member_unaffected(self, household, owner):
        """A second user in the same household has their own independent quota."""
        other = _make_user("services-other@test.dev")
        _add_member(other, household, role=HouseholdMember.Role.MEMBER)
        other.active_household = household
        other.save(update_fields=["active_household"])

        # Fill the owner's quota.
        _fill_quota(household, owner)

        # The other user can still create an active briefing.
        b = create_briefing(
            household, other, title="Other active", prompt="Mine.",
            is_active=True, send_times=["06:00"],
        )
        assert b.pk is not None
        assert b.is_active is True


# ── TestUpdateBriefingService ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestUpdateBriefingService:
    """update_briefing — field edits and quota on is_active toggle."""

    def _make_briefing(self, household, user, **kwargs) -> Briefing:
        # A schedule is required to activate a briefing (lot 3), so give every
        # fixture one send time by default.
        defaults = {
            "title": "Original",
            "prompt": "Original prompt.",
            "is_active": False,
            "send_times": [time(6, 0)],
        }
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def test_edit_fields_persists(self, household, owner):
        b = self._make_briefing(household, owner)
        updated = update_briefing(household, owner, b, fields={"title": "Updated", "prompt": "New prompt."})
        b.refresh_from_db()
        assert updated.title == "Updated"
        assert b.title == "Updated"
        assert b.prompt == "New prompt."

    def test_turning_on_when_under_quota_succeeds(self, household, owner):
        b = self._make_briefing(household, owner, is_active=False)
        updated = update_briefing(household, owner, b, fields={"is_active": True})
        b.refresh_from_db()
        assert updated.is_active is True
        assert b.is_active is True

    def test_turning_on_at_quota_raises_validation_error(self, household, owner):
        """Activating an existing briefing when user already has 10 active must fail."""
        b = self._make_briefing(household, owner, is_active=False)
        _fill_quota(household, owner)
        with pytest.raises(drf_serializers.ValidationError) as exc_info:
            update_briefing(household, owner, b, fields={"is_active": True})
        assert "is_active" in exc_info.value.detail

    def test_turning_on_excludes_self_from_quota_count(self, household, owner):
        """Updating is_active=True on an already-active briefing must not count self."""
        b = self._make_briefing(household, owner, is_active=True)
        # Fill quota with 9 others (b itself is already active = 1 + 9 = 10 total).
        _fill_quota(household, owner, count=MAX_ACTIVE_BRIEFINGS_PER_USER - 1)
        # Re-saving the same briefing as active should be allowed (self excluded).
        updated = update_briefing(household, owner, b, fields={"is_active": True, "title": "Still on"})
        assert updated.is_active is True

    def test_edit_without_toggling_is_active_never_triggers_quota(self, household, owner):
        _fill_quota(household, owner)
        # Create one more inactive to edit (bypassing the service).
        b = self._make_briefing(household, owner, is_active=False)
        # Updating non-active fields must succeed even when quota full.
        updated = update_briefing(household, owner, b, fields={"title": "Quota-safe edit"})
        assert updated.title == "Quota-safe edit"


# ── TestDeleteBriefingService ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestDeleteBriefingService:
    """delete_briefing — removes the instance."""

    def test_delete_removes_from_db(self, household, owner):
        b = Briefing.objects.create(
            household=household, created_by=owner, title="Bye", prompt="Gone."
        )
        pk = b.pk
        delete_briefing(b)
        assert not Briefing.objects.filter(pk=pk).exists()


# ── TestResolveBriefingService ────────────────────────────────────────────────

@pytest.mark.django_db
class TestResolveBriefingService:
    """resolve_briefing — household-scoped lookup by primary key."""

    def _make_briefing(self, household, user, **kwargs) -> Briefing:
        defaults = {"title": "Resolve me", "prompt": "Find me."}
        defaults.update(kwargs)
        return Briefing.objects.create(household=household, created_by=user, **defaults)

    def _briefing_payload(self, **overrides):
        return {"title": "Resolve me", "prompt": "Find me.", **overrides}

    def test_returns_briefing_for_correct_household(self, household, owner):
        b = self._make_briefing(household, owner)
        result = resolve_briefing(household, b.pk)
        assert result is not None
        assert result.pk == b.pk

    def test_returns_none_for_unknown_pk(self, household, owner):
        import uuid
        result = resolve_briefing(household, uuid.uuid4())
        assert result is None

    def test_returns_none_for_briefing_in_another_household(self, household, owner):
        """A briefing that exists but belongs to a different household must not be resolved."""
        other_user = _make_user("resolve-other@test.dev")
        other_hh = _make_household("Resolve Other House")
        _add_member(other_user, other_hh)
        b = self._make_briefing(other_hh, other_user)
        # Resolving with the first household — must return None (cross-household guard).
        result = resolve_briefing(household, b.pk)
        assert result is None
