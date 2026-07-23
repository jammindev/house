"""Model-level tests for Briefing.

Coverage:
1. __str__ output — verifies the (scope, state) format.
2. Default field values — is_active=False, is_private=False, briefing_type=recurring.
"""
import pytest

from accounts.tests.factories import UserFactory
from briefings.models import Briefing
from households.models import Household, HouseholdMember


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(email: str):
    return UserFactory(email=email)


def _make_household(name: str = "Test House") -> Household:
    return Household.objects.create(name=name)


def _add_member(user, household, role=HouseholdMember.Role.OWNER) -> HouseholdMember:
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _make_briefing(household, user, **kwargs) -> Briefing:
    defaults = {
        "title": "Daily weather",
        "prompt": "Summarise tomorrow's weather.",
        "household": household,
        "created_by": user,
    }
    defaults.update(kwargs)
    return Briefing.objects.create(**defaults)


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBriefingStr:
    """Briefing.__str__ embeds scope (shared/private) and state (on/off)."""

    def test_str_shared_inactive(self):
        user = _make_user("briefing-str-owner@test.dev")
        hh = _make_household("Str House")
        _add_member(user, hh)
        b = _make_briefing(hh, user, title="Morning brief", is_private=False, is_active=False)
        assert str(b) == "Morning brief (shared, off)"

    def test_str_private_active(self):
        user = _make_user("briefing-str-priv@test.dev")
        hh = _make_household("Str Private House")
        _add_member(user, hh)
        b = _make_briefing(hh, user, title="My secret", is_private=True, is_active=True)
        assert str(b) == "My secret (private, on)"

    def test_str_shared_active(self):
        user = _make_user("briefing-str-act@test.dev")
        hh = _make_household("Str Active House")
        _add_member(user, hh)
        b = _make_briefing(hh, user, title="Evening digest", is_private=False, is_active=True)
        assert str(b) == "Evening digest (shared, on)"


@pytest.mark.django_db
class TestBriefingDefaults:
    """Briefing field defaults — is_active, is_private, briefing_type, channel."""

    def test_default_is_active_false(self):
        user = _make_user("briefing-def-owner@test.dev")
        hh = _make_household("Defaults House")
        _add_member(user, hh)
        b = _make_briefing(hh, user)
        assert b.is_active is False

    def test_default_is_private_false(self):
        user = _make_user("briefing-def-priv@test.dev")
        hh = _make_household("Defaults Priv House")
        _add_member(user, hh)
        b = _make_briefing(hh, user)
        assert b.is_private is False

    def test_default_briefing_type_recurring(self):
        user = _make_user("briefing-def-type@test.dev")
        hh = _make_household("Defaults Type House")
        _add_member(user, hh)
        b = _make_briefing(hh, user)
        assert b.briefing_type == Briefing.Type.RECURRING

    def test_default_channel_telegram(self):
        user = _make_user("briefing-def-chan@test.dev")
        hh = _make_household("Defaults Chan House")
        _add_member(user, hh)
        b = _make_briefing(hh, user)
        assert b.channel == Briefing.Channel.TELEGRAM

    def test_default_condition_empty(self):
        user = _make_user("briefing-def-cond@test.dev")
        hh = _make_household("Defaults Cond House")
        _add_member(user, hh)
        b = _make_briefing(hh, user)
        assert b.condition == ""
