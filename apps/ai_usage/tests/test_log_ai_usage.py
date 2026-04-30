"""Tests for the log_ai_usage helper."""
from __future__ import annotations

import pytest

from ai_usage.models import AIUsageLog
from ai_usage.services import log_ai_usage
from households.models import Household


@pytest.fixture
def household(db):
    return Household.objects.create(name="AIUsage House")


def test_creates_row(household):
    row = log_ai_usage(
        household_id=household.id,
        feature="agent_ask",
        model="claude-haiku-4-5",
        duration_ms=42,
        input_tokens=10,
        output_tokens=5,
    )
    assert row is not None
    assert AIUsageLog.objects.count() == 1
    assert row.feature == "agent_ask"
    assert row.provider == "anthropic"
    assert row.model == "claude-haiku-4-5"
    assert row.success is True


def test_failure_path_logs_error_type(household):
    row = log_ai_usage(
        household_id=household.id,
        feature="agent_ask",
        model="claude-haiku-4-5",
        duration_ms=42,
        success=False,
        error_type="timeout",
    )
    assert row.success is False
    assert row.error_type == "timeout"


def test_swallows_db_errors_and_returns_none():
    """Logging itself must never raise (it's observability, not business logic)."""
    # Pass an invalid household_id (not a UUID); should not raise.
    row = log_ai_usage(
        household_id="not-a-uuid",
        feature="agent_ask",
        model="m",
        duration_ms=1,
    )
    assert row is None
