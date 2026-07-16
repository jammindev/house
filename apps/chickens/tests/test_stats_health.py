"""
Tests for parcours 14 Lot 6 — stats & health (curve, coverage, cost, drop alert).

The pivot under test everywhere: an unlogged day is *unknown*, never a zero.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from chickens import services
from chickens.alerts import evaluate_egg_drop_alert
from chickens.models import ChickenEvent, EggLog
from interactions.services import create_expense_interaction

from .factories import (
    ChickenFactory,
    EggLogFactory,
    HouseholdFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def hh():
    return HouseholdFactory()


@pytest.fixture
def user():
    return UserFactory()


def _log(hh, user, d, count):
    return EggLogFactory(household=hh, created_by=user, date=d, count=count)


# --- Lot 6.1 : egg_stats period + coverage -----------------------------------


class TestEggStatsCoverage:
    def test_unlogged_days_are_null_not_zero(self, hh, user):
        today = date(2024, 6, 30)
        _log(hh, user, today, 4)
        _log(hh, user, today - timedelta(days=2), 3)

        stats = services.egg_stats(hh, period=7, today=today)

        by_date = {p["date"]: p["count"] for p in stats["series"]}
        assert by_date[today.isoformat()] == 4
        # a day never logged stays null in the series (the chart breaks the line)
        assert by_date[(today - timedelta(days=1)).isoformat()] is None
        assert len(stats["series"]) == 7

    def test_coverage_counts_only_logged_days(self, hh, user):
        today = date(2024, 6, 30)
        for i in range(3):
            _log(hh, user, today - timedelta(days=i), 2)

        stats = services.egg_stats(hh, period=30, today=today)

        assert stats["coverage"] == {"logged_days": 3, "total_days": 30, "rate": round(3 / 30, 3)}

    def test_period_avg_divides_by_logged_days_not_calendar(self, hh, user):
        today = date(2024, 6, 30)
        _log(hh, user, today, 6)
        _log(hh, user, today - timedelta(days=1), 4)
        # 10 eggs over 2 *logged* days = 5.0, not 10/30
        stats = services.egg_stats(hh, period=30, today=today)
        assert stats["period_avg"] == 5.0
        assert stats["period_total"] == 10

    def test_real_zero_counts_in_average(self, hh, user):
        today = date(2024, 6, 30)
        _log(hh, user, today, 0)  # a real "no eggs" day
        _log(hh, user, today - timedelta(days=1), 4)
        stats = services.egg_stats(hh, period=30, today=today)
        # (0 + 4) / 2 logged days = 2.0 — the real zero pulls the average down
        assert stats["period_avg"] == 2.0
        assert stats["coverage"]["logged_days"] == 2

    def test_best_day(self, hh, user):
        today = date(2024, 6, 30)
        _log(hh, user, today, 3)
        _log(hh, user, today - timedelta(days=1), 7)
        stats = services.egg_stats(hh, period=7, today=today)
        assert stats["best_day"] == {"date": (today - timedelta(days=1)).isoformat(), "count": 7}

    def test_invalid_period_falls_back_to_30(self, hh, user):
        stats = services.egg_stats(hh, period=999, today=date(2024, 6, 30))
        assert stats["period"] == 30
        assert len(stats["series"]) == 30

    def test_empty_household(self, hh):
        stats = services.egg_stats(hh, period=30, today=date(2024, 6, 30))
        assert stats["period_avg"] is None
        assert stats["best_day"] is None
        assert stats["coverage"]["logged_days"] == 0
        assert all(p["count"] is None for p in stats["series"])


# --- Lot 6.2 : cost breakdown -------------------------------------------------


class TestCostBreakdown:
    def test_flock_purchase_counts_and_splits(self, hh, user):
        today = timezone.localdate()
        hen = ChickenFactory(household=hh, created_by=user)
        create_expense_interaction(
            source=hen, user=user, amount=Decimal("20.00"),
            supplier="Vet", occurred_at=timezone.now(), kind="chickens_purchase",
        )
        EggLogFactory(household=hh, created_by=user, date=today, count=10)

        cost = services._cost_totals(hh, today=today, feed_stock_item=None)

        assert cost["flock_total"] == "20.00"
        assert cost["feed_total"] == "0"
        assert cost["total"] == "20.00"
        # 20 / 10 eggs
        assert cost["per_egg"] == "2.00"

    def test_no_eggs_gives_null_per_egg(self, hh, user):
        today = timezone.localdate()
        hen = ChickenFactory(household=hh, created_by=user)
        create_expense_interaction(
            source=hen, user=user, amount=Decimal("20.00"),
            supplier="Vet", occurred_at=timezone.now(), kind="chickens_purchase",
        )
        cost = services._cost_totals(hh, today=today, feed_stock_item=None)
        assert cost["per_egg"] is None

    def test_no_expense_gives_null_per_egg(self, hh, user):
        today = timezone.localdate()
        EggLogFactory(household=hh, created_by=user, date=today, count=5)
        cost = services._cost_totals(hh, today=today, feed_stock_item=None)
        assert cost["per_egg"] is None


# --- Lot 6.3 : egg-drop alert -------------------------------------------------


def _baseline_and_recent(hh, user, today, baseline_count, recent_count):
    """Fill 30 baseline days (ending 7d ago) and 7 recent days with fixed counts."""
    baseline_end = today - timedelta(days=7)
    for i in range(30):
        _log(hh, user, baseline_end - timedelta(days=i), baseline_count)
    for i in range(7):
        _log(hh, user, today - timedelta(days=i), recent_count)


class TestEggDropAlert:
    def test_no_alert_without_enough_baseline(self, hh, user):
        today = date(2024, 6, 30)
        # only a few recent days, no baseline
        for i in range(5):
            _log(hh, user, today - timedelta(days=i), 1)
        assert evaluate_egg_drop_alert(hh, today) is None

    def test_no_alert_when_laying_stable(self, hh, user):
        today = date(2024, 6, 30)
        _baseline_and_recent(hh, user, today, baseline_count=5, recent_count=5)
        assert evaluate_egg_drop_alert(hh, today) is None

    def test_alert_on_significant_drop_unknown_cause(self, hh, user):
        today = date(2024, 6, 30)
        _baseline_and_recent(hh, user, today, baseline_count=5, recent_count=2)  # -60%
        alert = evaluate_egg_drop_alert(hh, today)
        assert alert is not None
        assert alert["kind"] == "egg_drop"
        assert alert["cause"] == "unknown"
        assert alert["drop_pct"] == 60
        assert alert["severity"] == "critical"

    def test_moderate_drop_is_warning(self, hh, user):
        today = date(2024, 6, 30)
        _baseline_and_recent(hh, user, today, baseline_count=10, recent_count=5)  # -50%
        alert = evaluate_egg_drop_alert(hh, today)
        assert alert is not None
        assert alert["severity"] == "warning"

    def test_molt_event_explains_drop(self, hh, user):
        today = date(2024, 6, 30)
        _baseline_and_recent(hh, user, today, baseline_count=6, recent_count=2)
        ChickenEvent.objects.create(
            household=hh, created_by=user, type=ChickenEvent.Type.MOLT,
            occurred_on=today - timedelta(days=10), title="Mue",
        )
        alert = evaluate_egg_drop_alert(hh, today)
        assert alert["cause"] == "molt"

    def test_old_molt_does_not_explain(self, hh, user):
        today = date(2024, 6, 30)
        _baseline_and_recent(hh, user, today, baseline_count=6, recent_count=2)
        ChickenEvent.objects.create(
            household=hh, created_by=user, type=ChickenEvent.Type.MOLT,
            occurred_on=today - timedelta(days=90), title="Vieille mue",
        )
        alert = evaluate_egg_drop_alert(hh, today)
        assert alert["cause"] == "unknown"

    def test_weather_cause(self, hh, user, monkeypatch):
        today = date(2024, 6, 30)
        _baseline_and_recent(hh, user, today, baseline_count=6, recent_count=2)
        monkeypatch.setattr(
            "weather.alerts.evaluate_weather_alerts",
            lambda household: [{"kind": "frost"}],
        )
        alert = evaluate_egg_drop_alert(hh, today)
        assert alert["cause"] == "weather"

    def test_molt_takes_priority_over_weather(self, hh, user, monkeypatch):
        today = date(2024, 6, 30)
        _baseline_and_recent(hh, user, today, baseline_count=6, recent_count=2)
        ChickenEvent.objects.create(
            household=hh, created_by=user, type=ChickenEvent.Type.MOLT,
            occurred_on=today - timedelta(days=5), title="Mue",
        )
        monkeypatch.setattr(
            "weather.alerts.evaluate_weather_alerts",
            lambda household: [{"kind": "frost"}],
        )
        assert evaluate_egg_drop_alert(hh, today)["cause"] == "molt"


class TestAlertsSummaryIntegration:
    def test_egg_drop_surfaces_in_summary(self, hh, user):
        from alerts.services import build_alerts_summary

        today = date(2024, 6, 30)
        _baseline_and_recent(hh, user, today, baseline_count=6, recent_count=1)
        summary = build_alerts_summary(hh, today)
        assert len(summary["egg_drop_alerts"]) == 1
        assert summary["total"] >= 1

    def test_disabled_module_hides_alert(self, hh, user):
        from alerts.services import build_alerts_summary

        today = date(2024, 6, 30)
        _baseline_and_recent(hh, user, today, baseline_count=6, recent_count=1)
        hh.disabled_modules = ["chickens"]
        hh.save(update_fields=["disabled_modules"])
        summary = build_alerts_summary(hh, today)
        assert summary["egg_drop_alerts"] == []


# --- Lot 6.4 : agent tool -----------------------------------------------------


class TestAgentStatsTool:
    def test_tool_reports_stats(self, hh, user):
        from chickens.agent import build_get_chicken_stats_tool

        ChickenFactory(household=hh, created_by=user)
        EggLogFactory(household=hh, created_by=user, date=timezone.localdate(), count=4)

        tool = build_get_chicken_stats_tool()
        result = tool.handler(household=hh, user=user, tool_input={})
        assert "Flock stats" in result.rendered
        assert "Hens in flock: 1" in result.rendered

    def test_tool_notes_disabled_module(self, hh, user):
        from chickens.agent import build_get_chicken_stats_tool

        hh.disabled_modules = ["chickens"]
        hh.save(update_fields=["disabled_modules"])
        tool = build_get_chicken_stats_tool()
        result = tool.handler(household=hh, user=user, tool_input={})
        assert "not enabled" in result.rendered
