"""Tests for the AI usage aggregations + the owner-only API (lot 6, #109)."""
from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent.models import AgentConversation, AgentMessage
from ai_usage import aggregations
from ai_usage.models import AIUsageLog
from households.models import Household, HouseholdMember


@pytest.fixture
def owner(db):
    return UserFactory(email="ai-usage-owner@example.com")


@pytest.fixture
def household(db, owner):
    h = Household.objects.create(name="Usage House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    owner.active_household = h
    owner.save(update_fields=["active_household"])
    return h


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


def _log(household, *, feature="agent_ask", duration_ms=100, success=True, age=None, **kw):
    row = AIUsageLog.objects.create(
        household=household,
        feature=feature,
        model="claude-haiku-4-5",
        duration_ms=duration_ms,
        success=success,
        **kw,
    )
    if age is not None:
        AIUsageLog.objects.filter(pk=row.pk).update(created_at=timezone.now() - age)
    return row


class TestSummary:
    def test_counts_errors_and_p95_per_window(self, household):
        for ms in (100, 200, 300, 400, 1000):
            _log(household, duration_ms=ms)
        _log(household, success=False, error_type="timeout")
        # Older than 24h but inside 7d.
        _log(household, duration_ms=50, age=timedelta(days=2))

        data = aggregations.summary(household.id)
        day = data["windows"]["24h"]
        week = data["windows"]["7d"]

        assert day["calls"] == 6
        assert day["errors"] == 1
        assert day["error_rate"] == pytest.approx(1 / 6)
        assert day["p95_ms"] == 1000
        assert week["calls"] == 7

    def test_empty_household_yields_none_rates(self, household):
        data = aggregations.summary(household.id)
        assert data["windows"]["24h"] == {
            "calls": 0,
            "errors": 0,
            "error_rate": None,
            "p95_ms": None,
            "idk_rate": None,
            "alerts": {"idk_rate": False, "p95_ms": False},
        }

    def test_idk_rate_comes_from_agent_messages(self, household, owner):
        conversation = AgentConversation.objects.create(household=household, created_by=owner)
        for kind in ("idk", "household", "idk", "direct"):
            AgentMessage.objects.create(
                conversation=conversation,
                role=AgentMessage.Role.AGENT,
                content="…",
                metadata={"answer_kind": kind},
            )
        data = aggregations.summary(household.id)
        assert data["windows"]["24h"]["idk_rate"] == pytest.approx(0.5)
        assert data["windows"]["24h"]["alerts"]["idk_rate"] is True

    def test_p95_alert_threshold(self, household):
        for _ in range(3):
            _log(household, duration_ms=15_000)
        data = aggregations.summary(household.id)
        assert data["windows"]["24h"]["alerts"]["p95_ms"] is True

    def test_scoped_to_household(self, household, owner):
        other = Household.objects.create(name="Elsewhere")
        _log(other)
        assert aggregations.summary(household.id)["windows"]["30d"]["calls"] == 0


class TestHistogram:
    def test_days_are_zero_filled_and_counts_grouped_by_feature(self, household):
        _log(household, feature="agent_ask")
        _log(household, feature="agent_ask")
        _log(household, feature="ocr_upload")
        _log(household, feature="ocr_upload", age=timedelta(days=3))

        data = aggregations.histogram(household.id, days=7)
        assert len(data["days"]) == 7
        assert data["features"] == ["agent_ask", "ocr_upload"]
        today = data["days"][-1]
        assert today["counts"] == {"agent_ask": 2, "ocr_upload": 1}
        three_days_ago = data["days"][-4]
        assert three_days_ago["counts"] == {"ocr_upload": 1}


class TestRecent:
    def test_returns_newest_first_with_feature_filter(self, household):
        _log(household, feature="ocr_upload", duration_ms=1)
        newest = _log(household, feature="agent_ask", duration_ms=2)

        rows = aggregations.recent(household.id)
        assert rows[0]["id"] == str(newest.id)
        assert len(rows) == 2

        only_agent = aggregations.recent(household.id, feature="agent_ask")
        assert [r["feature"] for r in only_agent] == ["agent_ask"]


class TestApi:
    def test_owner_gets_summary(self, owner_client, household):
        _log(household)
        resp = owner_client.get("/api/ai-usage/summary/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["windows"]["24h"]["calls"] == 1

    def test_histogram_and_recent_endpoints(self, owner_client, household):
        _log(household, feature="ocr_upload")
        histogram = owner_client.get("/api/ai-usage/histogram/?days=7")
        assert histogram.status_code == status.HTTP_200_OK
        assert len(histogram.json()["days"]) == 7

        recent = owner_client.get("/api/ai-usage/recent/?feature=ocr_upload")
        assert recent.status_code == status.HTTP_200_OK
        assert recent.json()["results"][0]["feature"] == "ocr_upload"

    def test_member_is_forbidden(self, household):
        member = UserFactory(email="ai-usage-member@example.com")
        HouseholdMember.objects.create(
            user=member, household=household, role=HouseholdMember.Role.MEMBER
        )
        member.active_household = household
        member.save(update_fields=["active_household"])
        client = APIClient()
        client.force_authenticate(user=member)

        for path in ("summary", "histogram", "recent"):
            resp = client.get(f"/api/ai-usage/{path}/")
            assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_is_rejected(self, db):
        resp = APIClient().get("/api/ai-usage/summary/")
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_owner_of_another_household_sees_nothing(self, owner_client, household):
        other = Household.objects.create(name="Elsewhere")
        _log(other)
        resp = owner_client.get("/api/ai-usage/summary/")
        assert resp.json()["windows"]["30d"]["calls"] == 0
