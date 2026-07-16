"""
Unit tests for agent.digest.collectors — one collector at a time.

Covers: happy path (section returned with expected lines), empty path (None),
and branch logic specific to each collector (threshold, drop %, private tasks, etc.).
All DB interactions use real models; external services are monkeypatched at the
module boundary.
"""
from __future__ import annotations

from datetime import date

import pytest

from agent.digest.collectors import (
    DigestSection,
    SECTION_KEYS,
    SECTION_SPECS,
    collect_chickens,
    collect_electricity,
    collect_stock,
    collect_tasks,
    collect_weather,
)
from chickens.tests.factories import HouseholdFactory, UserFactory, HouseholdMemberFactory
from electricity.tests.factories import ElectricityMeterFactory
from tasks.tests.factories import TaskFactory


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

TODAY = date(2026, 7, 16)


def _make_household_and_user(db):
    household = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user)
    return household, user


def _make_stock_category(household):
    from stock.models import StockCategory
    return StockCategory.objects.create(
        household=household,
        name="Alimentaire",
        color="#94a3b8",
        emoji="🍎",
    )


# ---------------------------------------------------------------------------
# collect_tasks
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCollectTasks:
    """collect_tasks: due tasks appear as Today/Overdue lines; None when empty."""

    def test_due_today_returns_today_line(self):
        household, user = _make_household_and_user(None)
        task = TaskFactory(
            household=household,
            created_by=user,
            due_date=TODAY,
            status="pending",
            subject="Fix the boiler",
        )
        section = collect_tasks(household, user, today=TODAY)
        assert section is not None
        assert any("Fix the boiler" in line and "Today" in line for line in section.lines)

    def test_overdue_task_has_overdue_prefix(self):
        household, user = _make_household_and_user(None)
        TaskFactory(
            household=household,
            created_by=user,
            due_date=date(2026, 7, 10),
            status="pending",
            subject="Old task",
        )
        section = collect_tasks(household, user, today=TODAY)
        assert section is not None
        assert any("Old task" in line and "Overdue" in line for line in section.lines)

    def test_no_due_tasks_returns_none(self):
        household, user = _make_household_and_user(None)
        # Task without due_date — should not appear
        TaskFactory(household=household, created_by=user, due_date=None, status="pending")
        section = collect_tasks(household, user, today=TODAY)
        assert section is None

    def test_future_task_not_included(self):
        household, user = _make_household_and_user(None)
        TaskFactory(
            household=household,
            created_by=user,
            due_date=date(2026, 8, 1),
            status="pending",
        )
        section = collect_tasks(household, user, today=TODAY)
        assert section is None

    def test_completed_task_excluded(self):
        household, user = _make_household_and_user(None)
        TaskFactory(
            household=household,
            created_by=user,
            due_date=TODAY,
            status="done",
        )
        section = collect_tasks(household, user, today=TODAY)
        assert section is None

    def test_private_task_of_other_user_excluded(self):
        household, user = _make_household_and_user(None)
        other_user = UserFactory()
        HouseholdMemberFactory(household=household, user=other_user)
        # Private task owned by 'other_user'; requesting as 'user' → must be invisible
        TaskFactory(
            household=household,
            created_by=other_user,
            due_date=TODAY,
            status="pending",
            is_private=True,
        )
        section = collect_tasks(household, user, today=TODAY)
        assert section is None

    def test_own_private_task_included(self):
        household, user = _make_household_and_user(None)
        TaskFactory(
            household=household,
            created_by=user,
            due_date=TODAY,
            status="pending",
            is_private=True,
            subject="My secret task",
        )
        section = collect_tasks(household, user, today=TODAY)
        assert section is not None
        assert any("My secret task" in line for line in section.lines)

    def test_public_task_of_other_user_included(self):
        household, user = _make_household_and_user(None)
        other_user = UserFactory()
        HouseholdMemberFactory(household=household, user=other_user)
        TaskFactory(
            household=household,
            created_by=other_user,
            due_date=TODAY,
            status="pending",
            is_private=False,
            subject="Public shared task",
        )
        section = collect_tasks(household, user, today=TODAY)
        assert section is not None
        assert any("Public shared task" in line for line in section.lines)

    def test_section_key_and_emoji(self):
        household, user = _make_household_and_user(None)
        TaskFactory(
            household=household, created_by=user, due_date=TODAY, status="pending"
        )
        section = collect_tasks(household, user, today=TODAY)
        assert section.key == "tasks"
        assert section.emoji == "✅"

    def test_backlog_and_in_progress_included(self):
        household, user = _make_household_and_user(None)
        TaskFactory(
            household=household, created_by=user, due_date=TODAY, status="backlog"
        )
        TaskFactory(
            household=household, created_by=user, due_date=TODAY, status="in_progress"
        )
        section = collect_tasks(household, user, today=TODAY)
        assert section is not None
        assert len(section.lines) == 2


# ---------------------------------------------------------------------------
# collect_weather
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCollectWeather:
    """collect_weather: uses evaluate_weather_alerts; dedups by kind."""

    def test_alerts_become_lines(self, monkeypatch):
        household, user = _make_household_and_user(None)
        monkeypatch.setattr(
            "weather.alerts.evaluate_weather_alerts",
            lambda hh: [{"kind": "frost", "severity": "warning"}],
        )
        monkeypatch.setattr(
            "weather.alerts.render_alert_line",
            lambda alert: "❄️ Frost warning",
        )
        section = collect_weather(household, user, today=TODAY)
        assert section is not None
        assert section.key == "weather"
        assert any("Frost warning" in line for line in section.lines)

    def test_no_alerts_returns_none(self, monkeypatch):
        household, user = _make_household_and_user(None)
        monkeypatch.setattr(
            "weather.alerts.evaluate_weather_alerts",
            lambda hh: [],
        )
        section = collect_weather(household, user, today=TODAY)
        assert section is None

    def test_duplicate_kind_is_deduped(self, monkeypatch):
        household, user = _make_household_and_user(None)
        monkeypatch.setattr(
            "weather.alerts.evaluate_weather_alerts",
            lambda hh: [
                {"kind": "rain", "severity": "low"},
                {"kind": "rain", "severity": "high"},  # same kind — must be skipped
            ],
        )
        monkeypatch.setattr(
            "weather.alerts.render_alert_line",
            lambda alert: "🌧 Rain",
        )
        section = collect_weather(household, user, today=TODAY)
        assert section is not None
        assert len(section.lines) == 1

    def test_multiple_distinct_kinds_all_appear(self, monkeypatch):
        household, user = _make_household_and_user(None)
        monkeypatch.setattr(
            "weather.alerts.evaluate_weather_alerts",
            lambda hh: [
                {"kind": "frost", "severity": "low"},
                {"kind": "wind", "severity": "high"},
            ],
        )
        call_count = {"n": 0}

        def _render(alert):
            call_count["n"] += 1
            return f"Line {call_count['n']}"

        monkeypatch.setattr("weather.alerts.render_alert_line", _render)
        section = collect_weather(household, user, today=TODAY)
        assert section is not None
        assert len(section.lines) == 2


# ---------------------------------------------------------------------------
# collect_stock
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCollectStock:
    """collect_stock: low/out items appear; in_stock items excluded."""

    def test_out_of_stock_item_appears(self):
        from stock.models import StockItem
        household, user = _make_household_and_user(None)
        cat = _make_stock_category(household)
        StockItem.objects.create(
            household=household,
            category=cat,
            name="Salt",
            status=StockItem.Status.OUT_OF_STOCK,
        )
        section = collect_stock(household, user, today=TODAY)
        assert section is not None
        assert any("Salt" in line and "out of stock" in line for line in section.lines)

    def test_low_stock_item_shows_quantity(self):
        from stock.models import StockItem
        household, user = _make_household_and_user(None)
        cat = _make_stock_category(household)
        StockItem.objects.create(
            household=household,
            category=cat,
            name="Flour",
            status=StockItem.Status.LOW_STOCK,
            quantity=0.5,
            unit="kg",
        )
        section = collect_stock(household, user, today=TODAY)
        assert section is not None
        assert any("Flour" in line and "low" in line for line in section.lines)

    def test_in_stock_items_excluded(self):
        from stock.models import StockItem
        household, user = _make_household_and_user(None)
        cat = _make_stock_category(household)
        StockItem.objects.create(
            household=household,
            category=cat,
            name="Pasta",
            status=StockItem.Status.IN_STOCK,
        )
        section = collect_stock(household, user, today=TODAY)
        assert section is None

    def test_empty_stock_returns_none(self):
        household, user = _make_household_and_user(None)
        section = collect_stock(household, user, today=TODAY)
        assert section is None

    def test_section_key_and_emoji(self):
        from stock.models import StockItem
        household, user = _make_household_and_user(None)
        cat = _make_stock_category(household)
        StockItem.objects.create(
            household=household,
            category=cat,
            name="Rice",
            status=StockItem.Status.OUT_OF_STOCK,
        )
        section = collect_stock(household, user, today=TODAY)
        assert section.key == "stock"
        assert section.emoji == "📦"

    def test_other_household_items_excluded(self):
        from stock.models import StockItem
        household, user = _make_household_and_user(None)
        other_household = HouseholdFactory()
        cat_other = _make_stock_category(other_household)
        StockItem.objects.create(
            household=other_household,
            category=cat_other,
            name="Intruder item",
            status=StockItem.Status.OUT_OF_STOCK,
        )
        section = collect_stock(household, user, today=TODAY)
        assert section is None


# ---------------------------------------------------------------------------
# collect_electricity
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCollectElectricity:
    """collect_electricity: fires only when cur > prev * (1 + threshold)."""

    def _make_meter(self, household, user):
        return ElectricityMeterFactory(household=household, created_by=user)

    def test_no_meters_returns_none(self):
        household, user = _make_household_and_user(None)
        section = collect_electricity(household, user, today=TODAY)
        assert section is None

    def test_below_threshold_returns_none(self, monkeypatch, settings):
        from datetime import timedelta
        household, user = _make_household_and_user(None)
        self._make_meter(household, user)
        settings.DIGEST_ELEC_ANOMALY_THRESHOLD = 0.30

        cur_from = TODAY - timedelta(days=29)

        def _fake_summary(hh, m, *, granularity, date_from, date_to):
            # cur period: 120 Wh, prev period: 100 Wh → ratio 1.20 < 1.30 → no alert
            if date_from == cur_from:
                return {"total_wh": 120}
            return {"total_wh": 100}

        monkeypatch.setattr(
            "electricity.services.consumption_summary",
            _fake_summary,
        )
        section = collect_electricity(household, user, today=TODAY)
        assert section is None

    def test_above_threshold_returns_section(self, monkeypatch, settings):
        from datetime import timedelta
        household, user = _make_household_and_user(None)
        self._make_meter(household, user)
        settings.DIGEST_ELEC_ANOMALY_THRESHOLD = 0.30

        cur_from = TODAY - timedelta(days=29)

        def _fake_summary(hh, m, *, granularity, date_from, date_to):
            if date_from == cur_from:
                return {"total_wh": 150}  # +50% vs prev
            return {"total_wh": 100}

        monkeypatch.setattr(
            "electricity.services.consumption_summary",
            _fake_summary,
        )
        section = collect_electricity(household, user, today=TODAY)
        assert section is not None
        assert section.key == "electricity"
        assert any("50" in line for line in section.lines)

    def test_prev_zero_returns_none(self, monkeypatch):
        from datetime import timedelta
        household, user = _make_household_and_user(None)
        self._make_meter(household, user)
        cur_from = TODAY - timedelta(days=29)

        def _fake_summary(hh, m, *, granularity, date_from, date_to):
            if date_from == cur_from:
                return {"total_wh": 100}
            return {"total_wh": 0}

        monkeypatch.setattr(
            "electricity.services.consumption_summary",
            _fake_summary,
        )
        section = collect_electricity(household, user, today=TODAY)
        assert section is None

    def test_cur_zero_returns_none(self, monkeypatch):
        from datetime import timedelta
        household, user = _make_household_and_user(None)
        self._make_meter(household, user)
        cur_from = TODAY - timedelta(days=29)

        def _fake_summary(hh, m, *, granularity, date_from, date_to):
            if date_from == cur_from:
                return {"total_wh": 0}
            return {"total_wh": 100}

        monkeypatch.setattr(
            "electricity.services.consumption_summary",
            _fake_summary,
        )
        section = collect_electricity(household, user, today=TODAY)
        assert section is None

    def test_section_key_and_emoji(self, monkeypatch, settings):
        from datetime import timedelta
        household, user = _make_household_and_user(None)
        self._make_meter(household, user)
        settings.DIGEST_ELEC_ANOMALY_THRESHOLD = 0.10
        cur_from = TODAY - timedelta(days=29)

        def _fake_summary(hh, m, *, granularity, date_from, date_to):
            return {"total_wh": 200 if date_from == cur_from else 100}

        monkeypatch.setattr(
            "electricity.services.consumption_summary",
            _fake_summary,
        )
        section = collect_electricity(household, user, today=TODAY)
        assert section.key == "electricity"
        assert section.emoji == "⚡"


# ---------------------------------------------------------------------------
# collect_chickens
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCollectChickens:
    """collect_chickens: fires only when 7-day avg < 80% of 30-day avg."""

    def test_normal_laying_returns_none(self, monkeypatch):
        household, user = _make_household_and_user(None)
        monkeypatch.setattr(
            "chickens.services.egg_stats",
            lambda hh, *, today=None: {"avg_7d": 5.0, "avg_30d": 5.0},
        )
        section = collect_chickens(household, user, today=TODAY)
        assert section is None

    def test_slight_drop_not_enough_returns_none(self, monkeypatch):
        household, user = _make_household_and_user(None)
        # avg_7d = 4.1, avg_30d = 5.0 → ratio 0.82 ≥ 0.80 → no alert
        monkeypatch.setattr(
            "chickens.services.egg_stats",
            lambda hh, *, today=None: {"avg_7d": 4.1, "avg_30d": 5.0},
        )
        section = collect_chickens(household, user, today=TODAY)
        assert section is None

    def test_significant_drop_returns_section(self, monkeypatch):
        household, user = _make_household_and_user(None)
        # avg_7d = 3.0, avg_30d = 5.0 → ratio 0.60 < 0.80 → alert
        monkeypatch.setattr(
            "chickens.services.egg_stats",
            lambda hh, *, today=None: {"avg_7d": 3.0, "avg_30d": 5.0},
        )
        section = collect_chickens(household, user, today=TODAY)
        assert section is not None
        assert section.key == "chickens"
        assert any("3.0" in line or "3" in line for line in section.lines)

    def test_missing_stats_returns_none(self, monkeypatch):
        household, user = _make_household_and_user(None)
        monkeypatch.setattr(
            "chickens.services.egg_stats",
            lambda hh, *, today=None: {},
        )
        section = collect_chickens(household, user, today=TODAY)
        assert section is None

    def test_section_key_and_emoji(self, monkeypatch):
        household, user = _make_household_and_user(None)
        monkeypatch.setattr(
            "chickens.services.egg_stats",
            lambda hh, *, today=None: {"avg_7d": 1.0, "avg_30d": 5.0},
        )
        section = collect_chickens(household, user, today=TODAY)
        assert section.key == "chickens"
        assert section.emoji == "🥚"


# ---------------------------------------------------------------------------
# Registry completeness
# ---------------------------------------------------------------------------

class TestRegistry:
    """SECTION_SPECS and SECTION_KEYS are coherent."""

    def test_section_keys_match_specs(self):
        assert SECTION_KEYS == tuple(spec.key for spec in SECTION_SPECS)

    def test_all_expected_keys_present(self):
        expected = {"tasks", "weather", "stock", "electricity", "chickens"}
        assert expected == set(SECTION_KEYS)
