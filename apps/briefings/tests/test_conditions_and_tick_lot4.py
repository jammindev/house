"""Tests for Briefings Lot 4: arbitrary condition evaluation.

Coverage:
1. _parse_verdict directly — SEND/skip/no-VERDICT token/missing REASON/case-insensitive.
2. evaluate_condition unit — empty condition (no LLM call, send=True, evaluated=False);
   VERDICT: SEND/SKIP path; no-VERDICT fail-safe; LLMTimeoutError → send=False, evaluated=True;
   LLMError → send=False, evaluated=True; case-insensitive verdict.
3. Tick condition gate — active briefing WITH condition:
   a. evaluate_condition returns send=False → BriefingSendLog(status=skipped_condition,
      content=reason), telegram NOT called, generate NOT called, summary skipped_condition=1.
   b. evaluate_condition returns send=True → status=sent, summary sent=1.
   c. Briefing WITHOUT condition still sends (evaluated=False path, no condition gate).
4. Tick idempotency with condition — a slot already skipped_condition is not re-evaluated
   on a second tick (noop, 1 log row total).
5. Preview endpoint — briefing WITH condition → condition_verdict {send, reason} present;
   briefing WITHOUT condition → condition_verdict is null. text always present.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone as dt_timezone
from unittest.mock import MagicMock

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from briefings.conditions import ConditionVerdict, _parse_verdict
from briefings.models import Briefing, BriefingSendLog
from households.models import Household, HouseholdMember
from telegram.models import TelegramAccount


# ── Shared test helpers ───────────────────────────────────────────────────────

def _make_user(email: str):
    return UserFactory(email=email)


def _make_household(name: str = "Condition House") -> Household:
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
        "title": "Condition test briefing",
        "prompt": "Give me a daily summary.",
        "condition": "",
        "is_private": True,
        "is_active": True,
        "send_times": [_SLOT_TIME],
        "weekdays": [],
    }
    defaults.update(kwargs)
    return Briefing.objects.create(household=household, created_by=user, **defaults)


def _make_telegram_account(user, chat_id: int) -> TelegramAccount:
    return TelegramAccount.objects.create(user=user, chat_id=chat_id)


class _FakeResult:
    """Minimal stand-in for agent.service.AnswerResult."""

    def __init__(self, answer: str = "VERDICT: SEND\nREASON: All good."):
        self.answer = answer
        self.citations = []


# Time constants — reuse the same Paris / UTC anchors established in lot 3 tests.
# 2026-01-06 is a Tuesday (weekday=1). Paris = UTC+1 (winter).
_FIXED_DATE = date(2026, 1, 6)
_SLOT_TIME = time(16, 0)
# 15:30 UTC = 16:30 Paris → after the 16:00 slot.
_NOW_AFTER_SLOT = datetime(2026, 1, 6, 15, 30, 0, tzinfo=dt_timezone.utc)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return _make_user("cond-owner@test.dev")


@pytest.fixture
def household(db, owner):
    hh = _make_household("Condition House")
    _add_member(owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def member(db, household):
    user = _make_user("cond-member@test.dev")
    _add_member(user, household, role=HouseholdMember.Role.MEMBER)
    return user


# ── 1. _parse_verdict ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestParseVerdict:
    """Unit tests for _parse_verdict — pure function, no DB interaction needed."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Parse test", "prompt": "Summary.", **overrides}

    def test_send_verdict_is_true(self):
        """VERDICT: SEND → send=True, evaluated=True."""
        result = _parse_verdict("VERDICT: SEND\nREASON: It is raining today.")
        assert result.send is True
        assert result.evaluated is True

    def test_skip_verdict_is_false(self):
        """VERDICT: SKIP → send=False, evaluated=True."""
        result = _parse_verdict("VERDICT: SKIP\nREASON: No rain today.")
        assert result.send is False
        assert result.evaluated is True

    def test_reason_extracted_when_present(self):
        """REASON: line is captured correctly."""
        result = _parse_verdict("VERDICT: SEND\nREASON: Tasks are overdue.")
        assert result.reason == "Tasks are overdue."

    def test_missing_reason_yields_empty_string(self):
        """No REASON line → reason is ''."""
        result = _parse_verdict("VERDICT: SEND")
        assert result.reason == ""

    def test_no_verdict_token_is_fail_safe(self):
        """Answer with no VERDICT token → send=False (fail-safe), evaluated=True."""
        result = _parse_verdict("I could not determine whether to send or skip.")
        assert result.send is False
        assert result.evaluated is True

    def test_no_verdict_has_fallback_reason(self):
        """No VERDICT token → a non-empty reason is set."""
        result = _parse_verdict("Unclear answer.")
        assert result.reason  # not empty

    def test_case_insensitive_send(self):
        """'verdict: send' (all lower-case) is accepted."""
        result = _parse_verdict("verdict: send\nreason: lowercase test")
        assert result.send is True

    def test_case_insensitive_skip(self):
        """'VERDICT: skip' (mixed case) is accepted."""
        result = _parse_verdict("VERDICT: skip\nREASON: lower skip")
        assert result.send is False

    def test_garbage_input_is_fail_safe(self):
        """Completely empty/garbage answer → send=False, evaluated=True."""
        result = _parse_verdict("")
        assert result.send is False
        assert result.evaluated is True


# ── 2. evaluate_condition ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEvaluateCondition:
    """Unit tests for evaluate_condition — monkeypatches agent.service.ask."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Eval test", "prompt": "Summary.", **overrides}

    def test_empty_condition_returns_send_true_without_llm_call(
        self, owner, household, monkeypatch
    ):
        """Empty condition → send=True, evaluated=False, ask never called."""
        from briefings.conditions import evaluate_condition

        ask_calls = []
        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: ask_calls.append(True) or _FakeResult(),
        )
        briefing = self._create_briefing(household, owner, condition="")

        verdict = evaluate_condition(briefing, recipient=owner)

        assert verdict.send is True
        assert verdict.evaluated is False
        assert len(ask_calls) == 0

    def test_whitespace_only_condition_is_treated_as_empty(
        self, owner, household, monkeypatch
    ):
        """A condition of only whitespace behaves like an empty condition."""
        from briefings.conditions import evaluate_condition

        ask_calls = []
        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: ask_calls.append(True) or _FakeResult(),
        )
        briefing = self._create_briefing(household, owner, condition="   ")

        verdict = evaluate_condition(briefing, recipient=owner)

        assert verdict.send is True
        assert verdict.evaluated is False
        assert len(ask_calls) == 0

    def test_verdict_send_returns_true(self, owner, household, monkeypatch):
        """ask returns VERDICT: SEND → send=True, evaluated=True."""
        from briefings.conditions import evaluate_condition

        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: _FakeResult("VERDICT: SEND\nREASON: It is raining."),
        )
        briefing = self._create_briefing(household, owner, condition="s'il pleut")

        verdict = evaluate_condition(briefing, recipient=owner)

        assert verdict.send is True
        assert verdict.evaluated is True
        assert verdict.reason == "It is raining."

    def test_verdict_skip_returns_false(self, owner, household, monkeypatch):
        """ask returns VERDICT: SKIP → send=False, evaluated=True."""
        from briefings.conditions import evaluate_condition

        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: _FakeResult("VERDICT: SKIP\nREASON: No rain today."),
        )
        briefing = self._create_briefing(household, owner, condition="s'il pleut")

        verdict = evaluate_condition(briefing, recipient=owner)

        assert verdict.send is False
        assert verdict.evaluated is True

    def test_no_verdict_token_in_answer_is_fail_safe(self, owner, household, monkeypatch):
        """ask returns an answer with no VERDICT line → send=False (fail-safe)."""
        from briefings.conditions import evaluate_condition

        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: _FakeResult("I am not sure what to do here."),
        )
        briefing = self._create_briefing(household, owner, condition="si la France joue")

        verdict = evaluate_condition(briefing, recipient=owner)

        assert verdict.send is False
        assert verdict.evaluated is True

    def test_llm_timeout_error_returns_send_false_evaluated_true(
        self, owner, household, monkeypatch
    ):
        """LLMTimeoutError from ask → send=False, evaluated=True (not re-raises)."""
        from agent.llm import LLMTimeoutError
        from briefings.conditions import evaluate_condition

        def _raise(*a, **kw):
            raise LLMTimeoutError("Timeout")

        monkeypatch.setattr("agent.service.ask", _raise)
        briefing = self._create_briefing(household, owner, condition="si la France joue")

        verdict = evaluate_condition(briefing, recipient=owner)

        assert verdict.send is False
        assert verdict.evaluated is True

    def test_llm_error_returns_send_false_evaluated_true(
        self, owner, household, monkeypatch
    ):
        """LLMError (non-timeout) from ask → send=False, evaluated=True."""
        from agent.llm import LLMError
        from briefings.conditions import evaluate_condition

        def _raise(*a, **kw):
            raise LLMError("API error")

        monkeypatch.setattr("agent.service.ask", _raise)
        briefing = self._create_briefing(household, owner, condition="si la France joue")

        verdict = evaluate_condition(briefing, recipient=owner)

        assert verdict.send is False
        assert verdict.evaluated is True

    def test_case_insensitive_verdict_in_evaluate(self, owner, household, monkeypatch):
        """evaluate_condition accepts lower-case 'verdict: send'."""
        from briefings.conditions import evaluate_condition

        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: _FakeResult("verdict: send\nreason: Lowercase works."),
        )
        briefing = self._create_briefing(household, owner, condition="si la France joue")

        verdict = evaluate_condition(briefing, recipient=owner)

        assert verdict.send is True


# ── 3a. Tick — condition returns send=False → skipped_condition ───────────────

@pytest.mark.django_db
class TestTickConditionSkip:
    """Tick with a condition that evaluates to skip: skipped_condition, no send."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Condition skip brief", "prompt": "Summary.", **overrides}

    def test_condition_skip_creates_log_status_skipped_condition(
        self, owner, household, monkeypatch
    ):
        """evaluate_condition→skip → BriefingSendLog(status=skipped_condition, content=reason)."""
        from briefings import scheduler as sched_module

        skip_reason = "No France match today."
        monkeypatch.setattr(
            sched_module,
            "evaluate_condition",
            lambda briefing, recipient: ConditionVerdict(
                send=False, reason=skip_reason, evaluated=True
            ),
        )

        generate_calls = []
        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: generate_calls.append(True) or _FakeResult("text"),
        )
        send_calls = []
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: send_calls.append(True) or True,
        )

        _make_telegram_account(owner, chat_id=1100001)
        briefing = self._create_briefing(
            household, owner,
            condition="si la France joue",
        )
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["skipped_condition"] == 1
        assert result["sent"] == 0

        # DB state: exactly one log row with correct status + reason stored
        log = BriefingSendLog.objects.get(briefing=briefing, user=owner)
        assert log.status == BriefingSendLog.Status.SKIPPED_CONDITION
        assert log.content == skip_reason
        assert log.slot_date == _FIXED_DATE
        assert log.slot_time == _SLOT_TIME

    def test_condition_skip_does_not_call_generate_or_telegram(
        self, owner, household, monkeypatch
    ):
        """When condition skips, neither generate_briefing_text nor send_agent_message is called."""
        from briefings import scheduler as sched_module

        monkeypatch.setattr(
            sched_module,
            "evaluate_condition",
            lambda briefing, recipient: ConditionVerdict(
                send=False, reason="No match.", evaluated=True
            ),
        )

        generate_calls = []
        # Patch agent.service.ask to detect if generation happened
        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: generate_calls.append(True) or _FakeResult("text"),
        )
        send_calls = []
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: send_calls.append(True) or True,
        )

        _make_telegram_account(owner, chat_id=1100002)
        briefing = self._create_briefing(household, owner, condition="si la France joue")
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        send_due_briefings(now=_NOW_AFTER_SLOT)

        assert len(generate_calls) == 0
        assert len(send_calls) == 0


# ── 3b. Tick — condition returns send=True → sent normally ────────────────────

@pytest.mark.django_db
class TestTickConditionSend:
    """Tick with a condition that evaluates to send: proceeds to generate + telegram."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Condition send brief", "prompt": "Summary.", **overrides}

    def test_condition_send_creates_sent_log(self, owner, household, monkeypatch):
        """evaluate_condition→send=True → status=sent, summary sent=1."""
        from briefings import scheduler as sched_module

        monkeypatch.setattr(
            sched_module,
            "evaluate_condition",
            lambda briefing, recipient: ConditionVerdict(
                send=True, reason="France plays tonight.", evaluated=True
            ),
        )
        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: _FakeResult("Generated briefing text."),
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )

        _make_telegram_account(owner, chat_id=1200001)
        briefing = self._create_briefing(household, owner, condition="si la France joue")
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["sent"] == 1
        assert result["skipped_condition"] == 0

        log = BriefingSendLog.objects.get(briefing=briefing, user=owner)
        assert log.status == BriefingSendLog.Status.SENT
        assert log.slot_date == _FIXED_DATE


# ── 3c. Tick — briefing WITHOUT condition still sends ─────────────────────────

@pytest.mark.django_db
class TestTickNoConditionAlwaysSends:
    """Briefing with empty condition is unconditional — evaluate_condition returns
    evaluated=False and the tick proceeds to generate + send without any LLM gate."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "No condition brief", "prompt": "Summary.", **overrides}

    def test_no_condition_briefing_is_sent(self, owner, household, monkeypatch):
        """Briefing with condition='' → evaluate_condition short-circuits to send=True.
        No condition-gate call to ask; generation proceeds normally."""
        ask_calls = []

        def _ask_stub(*args, **kwargs):
            ask_calls.append(kwargs.get("user"))
            return _FakeResult("Unconditional text.")

        monkeypatch.setattr("agent.service.ask", _ask_stub)
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )

        _make_telegram_account(owner, chat_id=1300001)
        briefing = self._create_briefing(household, owner, condition="")
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        result = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert result["sent"] == 1
        assert result["skipped_condition"] == 0

        log = BriefingSendLog.objects.get(briefing=briefing, user=owner)
        assert log.status == BriefingSendLog.Status.SENT


# ── 4. Tick idempotency with condition ────────────────────────────────────────

@pytest.mark.django_db
class TestTickConditionIdempotency:
    """A slot already marked skipped_condition is NOT re-evaluated on a second tick."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Idempotent condition brief", "prompt": "Summary.", **overrides}

    def test_second_tick_is_noop_after_skipped_condition(
        self, owner, household, monkeypatch
    ):
        """Two ticks for the same slot: first → skipped_condition; second → noop (1 log row)."""
        from briefings import scheduler as sched_module

        evaluate_calls = []

        def _skip(*a, recipient=None, **kw):
            evaluate_calls.append(True)
            return ConditionVerdict(send=False, reason="No match.", evaluated=True)

        monkeypatch.setattr(sched_module, "evaluate_condition", _skip)
        monkeypatch.setattr(
            "agent.service.ask",
            lambda *a, **kw: _FakeResult("text"),
        )
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )

        _make_telegram_account(owner, chat_id=1400001)
        briefing = self._create_briefing(household, owner, condition="si la France joue")
        Briefing.objects.filter(pk=briefing.pk).update(is_active=True)

        from briefings.scheduler import send_due_briefings
        r1 = send_due_briefings(now=_NOW_AFTER_SLOT)
        r2 = send_due_briefings(now=_NOW_AFTER_SLOT)

        assert r1["skipped_condition"] == 1
        assert r2["skipped_condition"] == 0
        assert r2["sent"] == 0

        # Still exactly one log row
        assert BriefingSendLog.objects.filter(briefing=briefing).count() == 1
        # evaluate_condition was only called once
        assert len(evaluate_calls) == 1


# ── 5. Preview endpoint — condition_verdict field ─────────────────────────────

@pytest.mark.django_db
class TestPreviewConditionVerdict:
    """Preview endpoint returns condition_verdict when briefing has a condition,
    null when it does not. text is always present in both cases."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, is_active=False, send_times=[], **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Preview cond brief", "prompt": "Summary.", **overrides}

    def test_with_condition_returns_condition_verdict_dict(
        self, owner, household, monkeypatch
    ):
        """Briefing with a condition → response.data['condition_verdict'] is a dict
        with 'send' and 'reason' keys."""
        import briefings.views as views_module

        monkeypatch.setattr(
            views_module,
            "generate_briefing_text",
            lambda briefing, recipient: "Generated text.",
        )
        monkeypatch.setattr(
            views_module,
            "evaluate_condition",
            lambda briefing, recipient: ConditionVerdict(
                send=True, reason="France plays tonight.", evaluated=True
            ),
        )

        briefing = self._create_briefing(
            household, owner, condition="si la France joue"
        )
        client = _client_for(owner)

        response = client.post(reverse("briefing-preview", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert "text" in response.data
        assert response.data["text"] == "Generated text."
        condition_verdict = response.data.get("condition_verdict")
        assert condition_verdict is not None
        assert "send" in condition_verdict
        assert "reason" in condition_verdict
        assert condition_verdict["send"] is True
        assert condition_verdict["reason"] == "France plays tonight."

    def test_with_condition_skip_verdict_in_preview(
        self, owner, household, monkeypatch
    ):
        """Briefing with condition and SKIP verdict → condition_verdict send=False."""
        import briefings.views as views_module

        monkeypatch.setattr(
            views_module,
            "generate_briefing_text",
            lambda briefing, recipient: "Generated text.",
        )
        monkeypatch.setattr(
            views_module,
            "evaluate_condition",
            lambda briefing, recipient: ConditionVerdict(
                send=False, reason="No match found.", evaluated=True
            ),
        )

        briefing = self._create_briefing(
            household, owner, condition="si la France joue"
        )
        client = _client_for(owner)

        response = client.post(reverse("briefing-preview", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["text"] == "Generated text."
        condition_verdict = response.data.get("condition_verdict")
        assert condition_verdict is not None
        assert condition_verdict["send"] is False
        assert condition_verdict["reason"] == "No match found."

    def test_without_condition_returns_null_condition_verdict(
        self, owner, household, monkeypatch
    ):
        """Briefing with empty condition → condition_verdict is null."""
        import briefings.views as views_module

        evaluate_calls = []
        monkeypatch.setattr(
            views_module,
            "generate_briefing_text",
            lambda briefing, recipient: "Text without condition.",
        )
        monkeypatch.setattr(
            views_module,
            "evaluate_condition",
            lambda briefing, recipient: evaluate_calls.append(True)
            or ConditionVerdict(send=True, reason="", evaluated=False),
        )

        briefing = self._create_briefing(household, owner, condition="")
        client = _client_for(owner)

        response = client.post(reverse("briefing-preview", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["text"] == "Text without condition."
        # condition_verdict must be null (None) when no condition set
        assert response.data.get("condition_verdict") is None
        # evaluate_condition must NOT have been called (view guards on condition)
        assert len(evaluate_calls) == 0

    def test_text_always_present_even_with_condition(
        self, owner, household, monkeypatch
    ):
        """text key is always present regardless of whether a condition exists."""
        import briefings.views as views_module

        monkeypatch.setattr(
            views_module,
            "generate_briefing_text",
            lambda briefing, recipient: "Always here.",
        )
        monkeypatch.setattr(
            views_module,
            "evaluate_condition",
            lambda briefing, recipient: ConditionVerdict(
                send=True, reason="Yes.", evaluated=True
            ),
        )

        briefing = self._create_briefing(
            household, owner, condition="si la France joue"
        )
        client = _client_for(owner)

        response = client.post(reverse("briefing-preview", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["text"] == "Always here."

    def test_anonymous_gets_401_on_preview_with_condition(self, owner, household):
        """Unauthenticated request → 401 even with a condition on the briefing."""
        briefing = self._create_briefing(
            household, owner, condition="si la France joue"
        )
        response = _anon_client().post(
            reverse("briefing-preview", args=[str(briefing.pk)])
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
