"""Tests for Briefings Lot 2: content generation + manual send.

Coverage:
1. generate_briefing_text — strips <cite/> markers, cleans whitespace.
2. _render_telegram — HTML-escapes title & body, wraps title in <b>.
3. send_briefing_now PRIVATE — only creator is recipient; with/without TelegramAccount.
4. send_briefing_now SHARED — all members; send_agent_message False → errors++;
   per-recipient fault isolation (one ask() raises → errors++, others still sent).
5. preview endpoint — creator 200, other member on shared 200, member on private 404,
   LLM error → 503.
6. send-now endpoint permissions — creator 200, non-creator member on shared 403,
   household owner (non-creator) on shared 200, anonymous 401.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from briefings.models import Briefing
from briefings.tests.factories import BriefingFactory
from households.models import Household, HouseholdMember
from telegram.models import TelegramAccount


# ── Shared helpers (mirror existing test_api_briefings.py) ───────────────────

def _make_user(email: str):
    return UserFactory(email=email)


def _make_household(name: str = "Gen House") -> Household:
    return Household.objects.create(name=name)


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
        "title": "Test briefing",
        "prompt": "Give me a daily summary.",
        "is_private": False,
        "is_active": True,
    }
    defaults.update(kwargs)
    return Briefing.objects.create(household=household, created_by=user, **defaults)


def _make_telegram_account(user, chat_id: int) -> TelegramAccount:
    return TelegramAccount.objects.create(user=user, chat_id=chat_id)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def owner(db):
    return _make_user("gen-owner@test.dev")


@pytest.fixture
def household(db, owner):
    hh = _make_household("Gen House")
    _add_member(owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def member(db, household):
    user = _make_user("gen-member@test.dev")
    _add_member(user, household, role=HouseholdMember.Role.MEMBER)
    return user


@pytest.fixture
def other_owner(db):
    return _make_user("gen-other@test.dev")


@pytest.fixture
def other_household(db, other_owner):
    hh = _make_household("Other Gen House")
    _add_member(other_owner, hh, role=HouseholdMember.Role.OWNER)
    return hh


# ── Fake agent result ─────────────────────────────────────────────────────────

class _FakeResult:
    """Minimal stand-in for agent.service.AnswerResult."""

    def __init__(self, answer: str):
        self.answer = answer
        self.citations = []


# ── TestGenerateBriefingText ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestGenerateBriefingText:
    """Unit tests for generate_briefing_text — mocks agent.service.ask."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Daily brief", "prompt": "What's new?", **overrides}

    def test_cite_markers_stripped_from_answer(self, owner, household, monkeypatch):
        """<cite id="..."/> tags must not appear in the returned text."""
        from briefings import generation

        raw = 'Voici ton briefing <cite id="task:1"/> et aussi <cite id="zone:2"/> ok'
        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult(raw))
        briefing = self._create_briefing(household, owner)

        result = generation.generate_briefing_text(briefing, recipient=owner)

        assert "<cite" not in result
        assert "Voici ton briefing" in result
        assert "ok" in result

    def test_cleaned_text_has_no_extra_whitespace(self, owner, household, monkeypatch):
        """Whitespace left by stripped markers is collapsed."""
        from briefings import generation

        # Two adjacent cite markers produce a double space after stripping.
        raw = "Hello <cite id=\"a:1\"/>  <cite id=\"b:2\"/> world"
        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult(raw))
        briefing = self._create_briefing(household, owner)

        result = generation.generate_briefing_text(briefing, recipient=owner)

        assert "  " not in result  # no double spaces
        assert "Hello" in result
        assert "world" in result

    def test_returns_plain_text_when_no_markers(self, owner, household, monkeypatch):
        """Clean agent answer is returned unchanged (except whitespace trim)."""
        from briefings import generation

        plain = "No tasks due today. Have a great day!"
        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult(plain))
        briefing = self._create_briefing(household, owner)

        result = generation.generate_briefing_text(briefing, recipient=owner)

        assert result == plain

    def test_multiple_cite_styles_stripped(self, owner, household, monkeypatch):
        """Both self-closing variants are stripped."""
        from briefings import generation

        raw = 'A<cite id="x:1"/> B<cite id="y:2" /> C'
        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult(raw))
        briefing = self._create_briefing(household, owner)

        result = generation.generate_briefing_text(briefing, recipient=owner)

        assert "<cite" not in result
        assert "A" in result
        assert "B" in result
        assert "C" in result


# ── TestRenderTelegram ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRenderTelegram:
    """Unit tests for _render_telegram — HTML escaping and formatting."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Brief", "prompt": "Summary.", **overrides}

    def test_title_wrapped_in_bold_tag(self, owner, household):
        """Title must appear inside <b>...</b>."""
        from briefings.generation import _render_telegram

        briefing = self._create_briefing(household, owner, title="My brief")
        result = _render_telegram(briefing, "Some body text.")

        assert result.startswith("<b>My brief</b>")

    def test_title_html_escaped(self, owner, household):
        """Special chars in the title must be HTML-escaped."""
        from briefings.generation import _render_telegram

        briefing = self._create_briefing(household, owner, title="Recap <Today> & More")
        result = _render_telegram(briefing, "body")

        assert "<Today>" not in result
        assert "&lt;Today&gt;" in result
        assert "&amp;" in result
        # Still wrapped in bold
        assert result.startswith("<b>")

    def test_body_html_escaped(self, owner, household):
        """Special chars in the body must be HTML-escaped."""
        from briefings.generation import _render_telegram

        briefing = self._create_briefing(household, owner, title="Brief")
        body = "Temp: 5 < 10 & it's 'cold'"
        result = _render_telegram(briefing, body)

        assert "<" not in result.split("</b>", 1)[1].lstrip("\n")  # no raw < in body
        assert "&lt;" in result
        assert "&amp;" in result

    def test_title_and_body_separated_by_blank_line(self, owner, household):
        """Title block and body must be separated by a blank line (\\n\\n)."""
        from briefings.generation import _render_telegram

        briefing = self._create_briefing(household, owner, title="T")
        result = _render_telegram(briefing, "B")

        assert "</b>\n\n" in result


# ── TestSendBriefingNowPrivate ────────────────────────────────────────────────

@pytest.mark.django_db
class TestSendBriefingNowPrivate:
    """send_briefing_now with a private briefing — only the creator is a recipient."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, is_private=True, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Private", "prompt": "My own summary.", **overrides}

    def test_creator_with_telegram_account_is_sent(self, owner, household, monkeypatch):
        """Private briefing: creator has TelegramAccount → sent=1."""
        from briefings.generation import send_briefing_now

        _make_telegram_account(owner, chat_id=100001)
        briefing = self._create_briefing(household, owner)

        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("Your summary."))
        send_spy = []
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: send_spy.append((account, payload)) or True,
        )

        result = send_briefing_now(briefing, triggered_by=owner)

        assert result["total_recipients"] == 1
        assert result["sent"] == 1
        assert result["skipped_no_telegram"] == 0
        assert result["errors"] == 0
        assert len(send_spy) == 1

    def test_creator_without_telegram_account_is_skipped(self, owner, household, monkeypatch):
        """Private briefing: no TelegramAccount → skipped_no_telegram=1, sent=0."""
        from briefings.generation import send_briefing_now

        # No TelegramAccount created for owner
        briefing = self._create_briefing(household, owner)

        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("Summary."))
        send_spy = []
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: send_spy.append(True) or True,
        )

        result = send_briefing_now(briefing, triggered_by=owner)

        assert result["total_recipients"] == 1
        assert result["sent"] == 0
        assert result["skipped_no_telegram"] == 1
        assert result["errors"] == 0
        assert len(send_spy) == 0

    def test_only_creator_receives_not_other_members(self, owner, household, member, monkeypatch):
        """Private briefing: member with TelegramAccount is NOT a recipient."""
        from briefings.generation import send_briefing_now

        _make_telegram_account(owner, chat_id=100002)
        _make_telegram_account(member, chat_id=100003)
        briefing = self._create_briefing(household, owner)

        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("Summary."))
        sent_accounts = []
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: sent_accounts.append(account.user_id) or True,
        )

        result = send_briefing_now(briefing, triggered_by=owner)

        # Only owner (creator) should appear in sent accounts
        assert result["total_recipients"] == 1
        assert result["sent"] == 1
        assert owner.id in sent_accounts
        assert member.id not in sent_accounts


# ── TestSendBriefingNowShared ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestSendBriefingNowShared:
    """send_briefing_now with a shared briefing — all household members are recipients."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, is_private=False, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Shared", "prompt": "All of us.", **overrides}

    def test_all_members_with_accounts_are_sent(self, owner, household, member, monkeypatch):
        """Shared briefing: both members have Telegram accounts → sent=2."""
        from briefings.generation import send_briefing_now

        _make_telegram_account(owner, chat_id=200001)
        _make_telegram_account(member, chat_id=200002)
        briefing = self._create_briefing(household, owner)

        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("All good."))
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )

        result = send_briefing_now(briefing, triggered_by=owner)

        assert result["total_recipients"] == 2
        assert result["sent"] == 2
        assert result["skipped_no_telegram"] == 0
        assert result["errors"] == 0

    def test_member_without_account_is_skipped(self, owner, household, member, monkeypatch):
        """Shared briefing: owner has account, member does not → skipped=1."""
        from briefings.generation import send_briefing_now

        _make_telegram_account(owner, chat_id=200003)
        # No account for member
        briefing = self._create_briefing(household, owner)

        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("Summary."))
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )

        result = send_briefing_now(briefing, triggered_by=owner)

        assert result["total_recipients"] == 2
        assert result["sent"] == 1
        assert result["skipped_no_telegram"] == 1
        assert result["errors"] == 0

    def test_send_agent_message_returning_false_counts_as_error(
        self, owner, household, member, monkeypatch
    ):
        """send_agent_message returning False → errors++ (not sent++)."""
        from briefings.generation import send_briefing_now

        _make_telegram_account(owner, chat_id=200004)
        _make_telegram_account(member, chat_id=200005)
        briefing = self._create_briefing(household, owner)

        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("Text."))
        # Always returns False
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: False,
        )

        result = send_briefing_now(briefing, triggered_by=owner)

        assert result["total_recipients"] == 2
        assert result["sent"] == 0
        assert result["errors"] == 2

    def test_one_recipient_ask_raises_is_isolated(self, owner, household, member, monkeypatch):
        """If ask() raises for one user, errors++ but the other recipient still gets sent."""
        from briefings.generation import send_briefing_now

        _make_telegram_account(owner, chat_id=200006)
        _make_telegram_account(member, chat_id=200007)
        briefing = self._create_briefing(household, owner)

        sent_accounts = []

        # Raise for member, succeed for owner
        def _ask_sometimes_fails(*args, user=None, **kwargs):
            if user is not None and user.id == member.id:
                raise RuntimeError("LLM kaboom")
            return _FakeResult("Good summary.")

        monkeypatch.setattr("agent.service.ask", _ask_sometimes_fails)
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: sent_accounts.append(account.user_id) or True,
        )

        result = send_briefing_now(briefing, triggered_by=owner)

        assert result["total_recipients"] == 2
        assert result["errors"] == 1
        assert result["sent"] == 1
        assert owner.id in sent_accounts
        assert member.id not in sent_accounts


# ── TestPreviewEndpoint ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPreviewEndpoint:
    """POST /api/briefings/briefings/<id>/preview/ — generate text, no side effects."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Preview brief", "prompt": "Preview content.", **overrides}

    def test_creator_gets_200_with_text(self, owner, household, monkeypatch):
        """Creator previewing their own briefing → 200 {text: ...}."""
        raw = "Your briefing text <cite id=\"x:1\"/> here."
        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult(raw))
        briefing = self._create_briefing(household, owner)
        client = _client_for(owner)

        response = client.post(reverse("briefing-preview", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert "text" in response.data
        assert "<cite" not in response.data["text"]

    def test_other_member_can_preview_shared_briefing(self, owner, household, member, monkeypatch):
        """A non-creator member may preview a shared briefing → 200."""
        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("The answer."))
        briefing = self._create_briefing(household, owner, is_private=False)
        client = _client_for(member)

        response = client.post(reverse("briefing-preview", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert "text" in response.data

    def test_member_cannot_preview_other_members_private_briefing(
        self, owner, household, member, monkeypatch
    ):
        """Private briefing not owned by the requesting member → 404 (queryset exclusion)."""
        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("Secret."))
        briefing = self._create_briefing(household, owner, is_private=True)
        client = _client_for(member)

        response = client.post(reverse("briefing-preview", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_llm_timeout_error_returns_503(self, owner, household, monkeypatch):
        """LLMTimeoutError propagates out of generate_briefing_text → 503."""
        from agent.llm import LLMTimeoutError

        def _raise(*a, **kw):
            raise LLMTimeoutError("Timeout")

        monkeypatch.setattr("agent.service.ask", _raise)
        briefing = self._create_briefing(household, owner)
        client = _client_for(owner)

        response = client.post(reverse("briefing-preview", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data.get("detail") == "generation_failed"

    def test_llm_error_returns_503(self, owner, household, monkeypatch):
        """LLMError (non-timeout) also returns 503."""
        from agent.llm import LLMError

        def _raise(*a, **kw):
            raise LLMError("API error")

        monkeypatch.setattr("agent.service.ask", _raise)
        briefing = self._create_briefing(household, owner)
        client = _client_for(owner)

        response = client.post(reverse("briefing-preview", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data.get("detail") == "generation_failed"

    def test_anonymous_gets_401(self, owner, household):
        """Unauthenticated request to preview → 401."""
        briefing = self._create_briefing(household, owner)
        response = _anon_client().post(reverse("briefing-preview", args=[str(briefing.pk)]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_preview_returns_404(
        self, owner, household, other_owner, other_household, monkeypatch
    ):
        """A briefing from another household is invisible → 404."""
        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("X"))
        foreign = _make_briefing(other_household, other_owner, is_private=False)
        client = _client_for(owner)

        response = client.post(reverse("briefing-preview", args=[str(foreign.pk)]))

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── TestSendNowEndpoint ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSendNowEndpoint:
    """POST /api/briefings/briefings/<id>/send-now/ — permission matrix."""

    def _create_briefing(self, household, user, **kwargs):
        return _make_briefing(household, user, **kwargs)

    def _briefing_payload(self, **overrides):
        return {"title": "Send now", "prompt": "Push it.", **overrides}

    def _patch_send(self, monkeypatch):
        """Suppress real agent + Telegram calls; return empty summary."""
        monkeypatch.setattr("agent.service.ask", lambda *a, **kw: _FakeResult("Text."))
        monkeypatch.setattr(
            "telegram.outbound.send_agent_message",
            lambda account, household, payload: True,
        )

    def test_creator_can_send_now(self, owner, household, monkeypatch):
        """Creator triggering send-now → 200 with summary dict."""
        self._patch_send(monkeypatch)
        briefing = self._create_briefing(household, owner, is_private=False)
        client = _client_for(owner)

        response = client.post(reverse("briefing-send-now", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK
        assert "sent" in response.data
        assert "total_recipients" in response.data
        assert "skipped_no_telegram" in response.data
        assert "errors" in response.data

    def test_non_creator_member_on_shared_briefing_gets_403(
        self, owner, household, member, monkeypatch
    ):
        """Non-creator, non-owner member cannot trigger send-now → 403."""
        self._patch_send(monkeypatch)
        briefing = self._create_briefing(household, owner, is_private=False)
        client = _client_for(member)

        response = client.post(reverse("briefing-send-now", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_household_owner_non_creator_can_send_shared_briefing(
        self, owner, household, monkeypatch
    ):
        """Household owner (non-creator) CAN send a shared briefing → 200."""
        self._patch_send(monkeypatch)
        co_creator = _make_user("gen-cocreator@test.dev")
        _add_member(co_creator, household, role=HouseholdMember.Role.MEMBER)
        briefing = self._create_briefing(household, co_creator, is_private=False)

        # owner is an OWNER role in the household but did not create the briefing
        client = _client_for(owner)
        response = client.post(reverse("briefing-send-now", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_200_OK

    def test_anonymous_gets_401(self, owner, household):
        """Unauthenticated send-now → 401."""
        briefing = self._create_briefing(household, owner)
        response = _anon_client().post(reverse("briefing-send-now", args=[str(briefing.pk)]))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_cannot_send_private_briefing_by_another_user(
        self, owner, household, member, monkeypatch
    ):
        """Private briefing owned by someone else → 404 (queryset exclusion)."""
        self._patch_send(monkeypatch)
        briefing = self._create_briefing(household, owner, is_private=True)
        client = _client_for(member)

        response = client.post(reverse("briefing-send-now", args=[str(briefing.pk)]))

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cross_household_send_now_returns_404(
        self, owner, household, other_owner, other_household, monkeypatch
    ):
        """Briefing from another household → 404."""
        self._patch_send(monkeypatch)
        foreign = _make_briefing(other_household, other_owner, is_private=False)
        client = _client_for(owner)

        response = client.post(reverse("briefing-send-now", args=[str(foreign.pk)]))

        assert response.status_code == status.HTTP_404_NOT_FOUND
