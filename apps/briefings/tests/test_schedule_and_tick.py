"""Tests for Briefings Lot 3: scheduling helpers + automatic send tick.

Coverage:
1. validate_schedule — gap enforcement, weekday range check.
2. Serializer/API validation — is_active without send_times → 400 (key is_active);
   times < 1h apart → 400 (key send_times); valid schedule → 201 + fields persisted;
   next_send_at non-null for active scheduled briefing.
3. next_send_at — today vs tomorrow, weekday restriction, inactive/no-times → None.
4. Tick due gating — before vs after slot: no log / 1 log (status=sent, content set).
5. Tick idempotency — second tick for same slot is noop (1 log row).
6. Tick weekday gate — wrong weekday → not sent.
7. Tick no-telegram — skipped_no_telegram++, NO log row created.
8. Tick shared briefing — all members with accounts receive.
9. Tick fault isolation — one recipient raises → error log, others still sent.
10. send_agent_message returns False → log row status=error.
11. Management command smoke — call_command runs without error.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone as dt_timezone
from zoneinfo import ZoneInfo

import pytest
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from briefings.models import Briefing, BriefingSendLog
from briefings.tests.factories import BriefingFactory
from households.models import Household, HouseholdMember
from telegram.models import TelegramAccount


# ── Shared test helpers ───────────────────────────────────────────────────────

def _make_user(email: str):
    return UserFactory(email=email)


def _make_household(name: str = "Schedule House") -> Household:
    return Household.objects.create(name=name, timezone="Europe/Paris")


def _add_member(user, household, role=HouseholdMember.Role.OWNER) -> HouseholdMember:
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


def _make_briefing(household, user, **kwargs) -> Briefing:
    defaults = {
        "title": "Test schedule briefing",
        "prompt": "Give me a daily summary.",
        "is_private": False,
        "is_active": False,
    }
    defaults.update(kwargs)
    return Briefing.objects.create(household=household, created_by=user, **defaults)


def _make_telegram_account(user, chat_id: int) -> TelegramAccount:
    return TelegramAccount.objects.create(user=user, chat_id=chat_id)


class _FakeResult:
    """Minimal stand-in for agent.service.AnswerResult."""

    def __init__(self, answer: str = "Generated briefing text."):
        self.answer = answer
        self.citations = []


# Europe/Paris is UTC+1 in winter, UTC+2 in summer.
# 2026-01-06 is a Tuesday (weekday=1) — stable, no DST confusion.
# Paris offset = UTC+1. So local 16:00 = UTC 15:00.
_FIXED_DATE = date(2026, 1, 6)  # Tuesday, weekday=1
_PARIS_TZ = ZoneInfo("Europe/Paris")
# now = 14:00 Paris time  = 13:00 UTC  (before 16:00 slot)
_NOW_BEFORE_SLOT = datetime(2026, 1, 6, 13, 0, 0, tzinfo=dt_timezone.utc)
# now = 16:30 Paris time = 15:30 UTC  (after 16:00 slot)
_NOW_AFTER_SLOT = datetime(2026, 1, 6, 15, 30, 0, tzinfo=dt_timezone.utc)
_SLOT_TIME = time(16, 0)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return _make_user("sched-owner@test.dev")


@pytest.fixture
def household(db, owner):
    hh = _make_household("Schedule House")
    _add_member(owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def member(db, household):
    user = _make_user("sched-member@test.dev")
    _add_member(user, household, role=HouseholdMember.Role.MEMBER)
    return user


@pytest.fixture
def other_owner(db):
    return _make_user("sched-other@test.dev")


@pytest.fixture
def other_household(db, other_owner):
    hh = _make_household("Other Sched House")
    _add_member(other_owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


# ── 1. validate_schedule ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestValidateSchedule:
    """Unit tests for schedule.validate_schedule — pure function, no HTTP."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Brief", "prompt": "Summary.", **overrides}

    def test_times_30_min_apart_raises_value_error(self):
        """Two times only 30 minutes apart violate the 1-hour anti-spam guard."""
        from briefings.schedule import validate_schedule

        with pytest.raises(ValueError, match="hour"):
            validate_schedule([time(8, 0), time(8, 30)], [])

    def test_times_exactly_1h_apart_is_valid(self):
        """Times exactly 1h apart should not raise."""
        from briefings.schedule import validate_schedule

        validate_schedule([time(8, 0), time(9, 0)], [])  # must not raise

    def test_times_more_than_1h_apart_is_valid(self):
        """Times >1h apart are fine."""
        from briefings.schedule import validate_schedule

        validate_schedule([time(8, 0), time(20, 0)], [])  # must not raise

    def test_weekday_7_raises_value_error(self):
        """Weekday value 7 is out of the Python 0–6 range."""
        from briefings.schedule import validate_schedule

        with pytest.raises(ValueError, match="weekday"):
            validate_schedule([], [7])

    def test_weekday_negative_raises_value_error(self):
        """Negative weekday is also invalid."""
        from briefings.schedule import validate_schedule

        with pytest.raises(ValueError):
            validate_schedule([], [-1])

    def test_all_weekdays_0_to_6_are_valid(self):
        """Every value 0..6 must be accepted."""
        from briefings.schedule import validate_schedule

        validate_schedule([], list(range(7)))  # must not raise

    def test_empty_lists_are_valid(self):
        """Empty send_times and weekdays are a valid (never-fires) schedule."""
        from briefings.schedule import validate_schedule

        validate_schedule([], [])  # must not raise


# ── 2. Serializer / API schedule validation ───────────────────────────────────

@pytest.mark.django_db
class TestBriefingScheduleAPIValidation:
    """API (POST) validates schedule fields and returns correct 400 keys."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        base = {
            "title": "Scheduled briefing",
            "prompt": "What's happening?",
            "channel": "telegram",
            "briefing_type": "recurring",
            "is_private": False,
            "is_active": False,
        }
        base.update(overrides)
        return base

    def test_active_without_send_times_returns_400_is_active(self, owner, household):
        """is_active=true with empty send_times → 400 with key 'is_active'."""
        client = _client_for(owner)
        payload = self._briefing_payload(is_active=True, send_times=[], weekdays=[])

        response = client.post(reverse("briefing-list"), payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_active" in response.data

    def test_times_less_than_1h_apart_returns_400_send_times(self, owner, household):
        """send_times < 1h apart → 400 with key 'send_times'."""
        client = _client_for(owner)
        payload = self._briefing_payload(
            send_times=["08:00", "08:30"], weekdays=[], is_active=False
        )

        response = client.post(reverse("briefing-list"), payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "send_times" in response.data

    def test_valid_schedule_creates_201_and_persists(self, owner, household):
        """Valid schedule (2 times 2h apart, weekday Mon only) → 201 + DB state."""
        client = _client_for(owner)
        payload = self._briefing_payload(
            send_times=["08:00", "20:00"],
            weekdays=[0],  # Monday only
            is_active=False,
        )

        response = client.post(reverse("briefing-list"), payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["send_times"] == ["08:00:00", "20:00:00"]
        assert response.data["weekdays"] == [0]
        # DB state
        briefing = Briefing.objects.get(id=response.data["id"])
        assert len(briefing.send_times) == 2
        assert briefing.weekdays == [0]

    def test_next_send_at_non_null_for_active_scheduled_briefing(self, owner, household):
        """next_send_at must be present and non-null for an active briefing with send_times."""
        # Create directly (bypass quota — is_active=True needs send_times)
        briefing = _make_briefing(
            household, owner,
            is_active=True,
            send_times=[time(16, 0)],
            weekdays=[],
        )
        client = _client_for(owner)

        response = client.get(reverse("briefing-detail", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert "next_send_at" in response.data
        assert response.data["next_send_at"] is not None

    def test_next_send_at_null_for_inactive_briefing(self, owner, household):
        """next_send_at is null when the briefing is inactive."""
        briefing = _make_briefing(
            household, owner,
            is_active=False,
            send_times=[time(16, 0)],
            weekdays=[],
        )
        client = _client_for(owner)

        response = client.get(reverse("briefing-detail", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["next_send_at"] is None

    def test_next_send_at_null_when_no_send_times(self, owner, household):
        """next_send_at is null when send_times is empty."""
        briefing = _make_briefing(
            household, owner,
            is_active=True,
            send_times=[],
            weekdays=[],
        )
        # Force is_active=True with no send_times directly in DB (bypasses serializer)
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)
        client = _client_for(owner)

        response = client.get(reverse("briefing-detail", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["next_send_at"] is None

    def test_anonymous_cannot_create_scheduled_briefing(self, owner, household):
        """Unauthenticated create → 401."""
        payload = self._briefing_payload(send_times=["16:00"], weekdays=[])
        response = _anon_client().post(reverse("briefing-list"), payload, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── 3. next_send_at helper ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestNextSendAt:
    """Unit tests for schedule.next_send_at — time arithmetic, weekday resolution."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Brief", "prompt": "Summary.", **overrides}

    def test_slot_not_yet_reached_resolves_to_today(self, owner, household):
        """now before 16:00 Paris → next fire is today at 16:00 Paris."""
        from briefings.schedule import next_send_at

        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[]
        )

        result = next_send_at(briefing, now=_NOW_BEFORE_SLOT)

        assert result is not None
        local = result.astimezone(_PARIS_TZ)
        assert local.date() == _FIXED_DATE
        assert local.hour == 16
        assert local.minute == 0

    def test_slot_already_passed_resolves_to_tomorrow(self, owner, household):
        """now after 16:00 Paris → next fire is tomorrow at 16:00 Paris."""
        from briefings.schedule import next_send_at

        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[]
        )

        result = next_send_at(briefing, now=_NOW_AFTER_SLOT)

        assert result is not None
        local = result.astimezone(_PARIS_TZ)
        assert local.date() > _FIXED_DATE

    def test_weekday_restricted_resolves_to_next_allowed_day(self, owner, household):
        """_FIXED_DATE is Tuesday (weekday=1). Restrict to [3] (Thursday) → 2 days ahead."""
        from briefings.schedule import next_send_at

        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[3]  # Thursday
        )

        # After-slot on Tuesday: today is done, next is Thursday
        result = next_send_at(briefing, now=_NOW_AFTER_SLOT)

        assert result is not None
        local = result.astimezone(_PARIS_TZ)
        assert local.weekday() == 3  # Thursday

    def test_inactive_briefing_returns_none(self, owner, household):
        """Inactive briefing → None regardless of schedule."""
        from briefings.schedule import next_send_at

        briefing = self._create_briefing(
            household, owner,
            is_active=False, send_times=[_SLOT_TIME], weekdays=[]
        )

        assert next_send_at(briefing, now=_NOW_BEFORE_SLOT) is None

    def test_no_send_times_returns_none(self, owner, household):
        """Active briefing with no times → None."""
        from briefings.schedule import next_send_at

        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[], weekdays=[]
        )
        # Force is_active without serializer
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)
        briefing.refresh_from_db()

        assert next_send_at(briefing, now=_NOW_BEFORE_SLOT) is None

    def test_earliest_of_multiple_slots_returned_when_not_yet_passed(
        self, owner, household
    ):
        """Two slots: 10:00 and 20:00 Paris. now = 14:00 → next is 20:00 today."""
        from briefings.schedule import next_send_at

        briefing = self._create_briefing(
            household, owner,
            is_active=True,
            send_times=[time(10, 0), time(20, 0)],
            weekdays=[],
        )
        # 13:00 UTC = 14:00 Paris (after 10:00, before 20:00)
        now = _NOW_BEFORE_SLOT  # 13:00 UTC = 14:00 Paris

        result = next_send_at(briefing, now=now)

        assert result is not None
        local = result.astimezone(_PARIS_TZ)
        assert local.date() == _FIXED_DATE
        assert local.hour == 20


# ── 4. Tick due gating ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTickDueGating:
    """send_due_briefings: slot not yet reached vs past — no-send vs send+log."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Tick brief", "prompt": "Summary.", **overrides}

    def _patch(self, monkeypatch, answer="briefing text", send_returns=True):
        monkeypatch.setattr(
            "agent.service.ask", lambda *a, **kw: _FakeResult(answer)
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: send_returns,
        )

    def test_before_slot_no_send_no_log(self, owner, household, monkeypatch):
        """now before 16:00 Paris → tick sends nothing and creates no log row."""
        self._patch(monkeypatch)
        _make_telegram_account(owner, chat_id=400001)
        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[], is_private=True
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_BEFORE_SLOT)

        assert result["sent"] == 0
        assert BriefingSendLog.objects.filter(briefing=briefing).count() == 0

    def test_after_slot_sent_and_log_created(self, owner, household, monkeypatch):
        """now after 16:00 Paris → tick sends once, creates a BriefingSendLog(status=sent)."""
        answer_text = "Your Tuesday summary."
        self._patch(monkeypatch, answer=answer_text)
        _make_telegram_account(owner, chat_id=400002)
        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[], is_private=True
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["sent"] == 1

        log = BriefingSendLog.objects.get(briefing=briefing, user=owner)
        assert log.status == BriefingSendLog.Status.SENT
        assert log.slot_date == _FIXED_DATE
        assert log.slot_time == _SLOT_TIME
        assert log.content  # content was stored


# ── 5. Tick idempotency ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTickIdempotency:
    """Two overlapping ticks for the same slot must not double-send."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Idempotent brief", "prompt": "Summary.", **overrides}

    def test_second_tick_is_noop_one_log_row(self, owner, household, monkeypatch):
        """Running send_due_briefings twice produces exactly 1 log row and 1 send."""
        send_calls = []
        monkeypatch.setattr(
            "agent.service.ask", lambda *a, **kw: _FakeResult("Daily update.")
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: send_calls.append(True) or True,
        )
        _make_telegram_account(owner, chat_id=500001)
        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[], is_private=True
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        r1 = send_due_briefings(now=_NOW_AFTER_SLOT)
        r2 = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert r1["sent"] == 1
        assert r2["sent"] == 0  # second tick is noop
        assert len(send_calls) == 1  # send_agent_message called exactly once
        assert BriefingSendLog.objects.filter(briefing=briefing).count() == 1


# ── 6. Tick weekday gate ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTickWeekdayGate:
    """Briefing restricted to a weekday != today is skipped entirely."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Weekday brief", "prompt": "Summary.", **overrides}

    def test_wrong_weekday_not_sent(self, owner, household, monkeypatch):
        """_FIXED_DATE is Tuesday (1). Restrict to [3] (Thursday) → sent=0."""
        monkeypatch.setattr(
            "agent.service.ask", lambda *a, **kw: _FakeResult("Skip me.")
        )
        send_spy = []
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: send_spy.append(True) or True,
        )
        _make_telegram_account(owner, chat_id=600001)
        briefing = self._create_briefing(
            household, owner,
            is_active=True,
            send_times=[_SLOT_TIME],
            weekdays=[3],  # Thursday only; today is Tuesday
            is_private=True,
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["sent"] == 0
        assert len(send_spy) == 0
        assert BriefingSendLog.objects.filter(briefing=briefing).count() == 0

    def test_correct_weekday_is_sent(self, owner, household, monkeypatch):
        """Restrict to [1] (Tuesday) → sent=1 (today is Tuesday)."""
        monkeypatch.setattr(
            "agent.service.ask", lambda *a, **kw: _FakeResult("Send me.")
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )
        _make_telegram_account(owner, chat_id=600002)
        briefing = self._create_briefing(
            household, owner,
            is_active=True,
            send_times=[_SLOT_TIME],
            weekdays=[1],  # Tuesday = _FIXED_DATE's weekday
            is_private=True,
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["sent"] == 1


# ── 7. Tick no-telegram ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTickNoTelegram:
    """Recipient without a TelegramAccount → skipped, no log row (retryable)."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "No-telegram brief", "prompt": "Summary.", **overrides}

    def test_no_telegram_account_skipped_no_log_created(
        self, owner, household, monkeypatch
    ):
        """No TelegramAccount → skipped_no_telegram++, zero log rows."""
        ask_calls = []
        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: ask_calls.append(True) or _FakeResult("text"),
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )
        # owner has no TelegramAccount
        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[], is_private=True
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["skipped_no_telegram"] == 1
        assert result["sent"] == 0
        # No log row — so a later tick can still deliver once the user links Telegram
        assert BriefingSendLog.objects.filter(briefing=briefing).count() == 0
        # Agent was not called — cost guard
        assert len(ask_calls) == 0


# ── 8. Tick shared briefing ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestTickSharedBriefing:
    """Shared briefing: all members with accounts receive; those without are skipped."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Shared tick brief", "prompt": "Summary.", **overrides}

    def test_all_members_with_accounts_receive(
        self, owner, household, member, monkeypatch
    ):
        """Both owner and member have Telegram → sent=2, 2 log rows."""
        monkeypatch.setattr(
            "agent.service.ask", lambda *a, **kw: _FakeResult("All good.")
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )
        _make_telegram_account(owner, chat_id=800001)
        _make_telegram_account(member, chat_id=800002)
        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[], is_private=False
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["sent"] == 2
        assert result["skipped_no_telegram"] == 0
        assert BriefingSendLog.objects.filter(briefing=briefing).count() == 2

    def test_member_without_account_is_skipped(
        self, owner, household, member, monkeypatch
    ):
        """Owner has Telegram, member does not → sent=1, skipped=1."""
        monkeypatch.setattr(
            "agent.service.ask", lambda *a, **kw: _FakeResult("Summary.")
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )
        _make_telegram_account(owner, chat_id=800003)
        # No TelegramAccount for member
        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[], is_private=False
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["sent"] == 1
        assert result["skipped_no_telegram"] == 1


# ── 9. Tick fault isolation ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestTickFaultIsolation:
    """One recipient raising must not prevent others from receiving."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Fault brief", "prompt": "Summary.", **overrides}

    def test_one_ask_raises_others_still_sent(
        self, owner, household, member, monkeypatch
    ):
        """agent.service.ask raises for member → errors=1 (log=error), owner still sent."""
        sent_to = []

        def _ask_sometimes_fails(*args, user=None, **kwargs):
            if user is not None and user.id == member.id:
                raise RuntimeError("LLM kaboom")
            return _FakeResult("Owner summary.")

        monkeypatch.setattr("agent.service.ask", _ask_sometimes_fails)
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: sent_to.append(account.user_id) or True,
        )
        _make_telegram_account(owner, chat_id=900001)
        _make_telegram_account(member, chat_id=900002)
        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[], is_private=False
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["errors"] == 1
        assert result["sent"] == 1
        assert owner.id in sent_to
        assert member.id not in sent_to

        # Owner's log → sent; member's log → error
        owner_log = BriefingSendLog.objects.get(briefing=briefing, user=owner)
        member_log = BriefingSendLog.objects.get(briefing=briefing, user=member)
        assert owner_log.status == BriefingSendLog.Status.SENT
        assert member_log.status == BriefingSendLog.Status.ERROR

    def test_tick_does_not_raise_when_briefing_level_exception(
        self, owner, household, monkeypatch
    ):
        """An unexpected exception inside _send_one_briefing is caught — tick never raises."""
        from briefings import scheduler as sched_module

        original = sched_module._send_one_briefing

        def _boom(briefing, now):
            raise RuntimeError("Catastrophic failure")

        monkeypatch.setattr(sched_module, "_send_one_briefing", _boom)
        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[]
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)  # must not raise

        assert result["errors"] == 1


# ── 10. send_agent_message returns False ─────────────────────────────────────

@pytest.mark.django_db
class TestTickSendReturnsFalse:
    """send_agent_message returning False → log row status=error, errors++ ."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "False-send brief", "prompt": "Summary.", **overrides}

    def test_send_returns_false_counted_as_error(
        self, owner, household, monkeypatch
    ):
        """send_agent_message → False: errors=1, log row status=error."""
        monkeypatch.setattr(
            "agent.service.ask", lambda *a, **kw: _FakeResult("text")
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: False,
        )
        _make_telegram_account(owner, chat_id=1000001)
        briefing = self._create_briefing(
            household, owner,
            is_active=True, send_times=[_SLOT_TIME], weekdays=[], is_private=True
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["errors"] == 1
        assert result["sent"] == 0

        log = BriefingSendLog.objects.get(briefing=briefing, user=owner)
        assert log.status == BriefingSendLog.Status.ERROR


# ── 11. Management command smoke ─────────────────────────────────────────────

# transactional: the command's tick calls close_old_connections(), which breaks
# the standard atomic test isolation — a real transaction survives the reconnect.
@pytest.mark.django_db(transaction=True)
class TestSendDueBriefingsCommand:
    """Management command send_due_briefings runs one tick without raising."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Cmd brief", "prompt": "Summary.", **overrides}

    def test_command_runs_without_error(self, owner, household, monkeypatch):
        """call_command('send_due_briefings') completes without raising."""
        monkeypatch.setattr(
            "agent.service.ask", lambda *a, **kw: _FakeResult("text")
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )
        # The command picks up real wall-clock time; ensure there is no due briefing
        # to avoid a real agent/Telegram call leaking through.
        call_command("send_due_briefings")  # must not raise
