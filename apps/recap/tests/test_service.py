# recap/tests/test_service.py
"""
Tests for recap.service — freezing, idempotence, isolation, gating.

Coverage:
  1. TestLastClosedMonth        — previous calendar month in the household tz
  2. TestGetOrGenerateRecap     — freezes once, never recomputes
  3. TestTheMoneyChapterAgreesWithTheBudgetReport — the regression that matters
  4. TestABrokenCollectorIsIsolated
  5. TestChapterGating          — a disabled module's chapter is absent, not empty
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from budget.report.service import get_or_generate_report
from interactions.services import create_manual_expense_interaction
from recap import chapters as chapters_module
from recap.models import HouseholdRecap
from recap.service import build_stats, get_or_generate_recap, last_closed_month

from .factories import HouseholdFactory, make_owner


def _make_expense(household, user, amount, *, month, subject="Test expense"):
    tz = ZoneInfo(getattr(household, "timezone", None) or "UTC")
    year, mon = (int(p) for p in month.split("-"))
    return create_manual_expense_interaction(
        household=household,
        user=user,
        subject=subject,
        amount=Decimal(str(amount)),
        occurred_at=datetime(year, mon, 15, tzinfo=tz),
    )


def _cards(stats, chapter_key):
    for chapter in stats.get("chapters") or []:
        if chapter["key"] == chapter_key:
            return chapter["cards"]
    return []


def _called_names_in_app() -> set[str]:
    """Every function/attribute name *called* anywhere in ``apps/recap/*.py``.

    Uses ``ast`` so the architectural guards below inspect real code and not the
    comments that explain them.
    """
    import ast
    import pathlib

    import recap

    names: set[str] = set()
    for path in pathlib.Path(recap.__file__).parent.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if isinstance(func, ast.Name):
                names.add(func.id)
            elif isinstance(func, ast.Attribute):
                names.add(func.attr)
    return names


# ===========================================================================
# 1. TestLastClosedMonth
# ===========================================================================


@pytest.mark.django_db
class TestLastClosedMonth:
    def test_returns_a_yyyy_mm_string(self):
        result = last_closed_month(HouseholdFactory())
        year, month = result.split("-")
        assert len(year) == 4 and len(month) == 2

    def test_is_strictly_before_the_current_month(self):
        from core.timezones import household_today

        hh = HouseholdFactory()
        today = household_today(hh)
        assert last_closed_month(hh) < f"{today.year:04d}-{today.month:02d}"


# ===========================================================================
# 2. TestGetOrGenerateRecap
# ===========================================================================


@pytest.mark.django_db
class TestGetOrGenerateRecap:
    def test_creates_the_recap_on_first_call(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-05")

        recap = get_or_generate_recap(hh, "2026-05")

        assert HouseholdRecap.objects.filter(id=recap.id).exists()
        assert recap.month == "2026-05"
        assert recap.household_id == hh.id

    def test_second_call_returns_the_same_object(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-05")

        first = get_or_generate_recap(hh, "2026-05")
        second = get_or_generate_recap(hh, "2026-05")

        assert first.id == second.id
        assert HouseholdRecap.objects.filter(household_id=hh.id, month="2026-05").count() == 1

    def test_an_expense_added_after_the_freeze_does_not_rewrite_the_month(self):
        """The whole point of a snapshot: a closed month is a memory, not a query."""
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-04")

        recap = get_or_generate_recap(hh, "2026-04")
        frozen = _cards(recap.stats, "money")[0]["value"]

        _make_expense(hh, owner, "900.00", month="2026-04")
        again = get_or_generate_recap(hh, "2026-04")

        assert _cards(again.stats, "money")[0]["value"] == frozen

    def test_the_snapshot_carries_its_month_and_a_card_count(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-05")

        recap = get_or_generate_recap(hh, "2026-05")

        assert recap.stats["month"] == "2026-05"
        assert recap.card_count == sum(
            len(c["cards"]) for c in recap.stats["chapters"]
        )

    def test_two_households_get_two_independent_recaps(self):
        hh_a, hh_b = HouseholdFactory(), HouseholdFactory()
        owner_a = make_owner(hh_a)
        _make_expense(hh_a, owner_a, "100.00", month="2026-05")

        recap_a = get_or_generate_recap(hh_a, "2026-05")
        recap_b = get_or_generate_recap(hh_b, "2026-05")

        assert recap_a.id != recap_b.id
        assert recap_b.card_count == 0  # nothing happened in B

    def test_a_month_with_nothing_to_tell_still_freezes_an_empty_snapshot(self):
        """« Rien à raconter » is an answer. The snapshot exists so we never recompute
        it hoping for a different one."""
        hh = HouseholdFactory()

        recap = get_or_generate_recap(hh, "2026-05")

        assert recap.stats["chapters"] == []
        assert recap.stats["generated_for"] == []
        assert recap.card_count == 0


# ===========================================================================
# 3. TestTheMoneyChapterAgreesWithTheBudgetReport
# ===========================================================================


@pytest.mark.django_db
class TestTheMoneyChapterAgreesWithTheBudgetReport:
    """Un compteur ne peut pas avoir deux définitions.

    The money chapter must *read* the frozen ``BudgetReport``. Two independently
    written sums drift by a rounding cent or a timezone bound, and two screens that
    contradict each other both lose their credit.
    """

    def test_the_total_is_the_report_total(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "120.55", month="2026-05")
        _make_expense(hh, owner, "80.45", month="2026-05")

        recap = get_or_generate_recap(hh, "2026-05")
        report = get_or_generate_report(hh, "2026-05")

        card = next(c for c in _cards(recap.stats, "money") if c["kind"] == "total_spent")
        assert card["value"] == report.stats["total_spent"]
        assert card["expense_count"] == report.stats["expense_count"]

    def test_the_biggest_expense_is_the_report_biggest(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "30.00", month="2026-05", subject="Cinema")
        _make_expense(hh, owner, "300.00", month="2026-05", subject="Plumber")

        recap = get_or_generate_recap(hh, "2026-05")
        report = get_or_generate_report(hh, "2026-05")

        card = next(
            c for c in _cards(recap.stats, "money") if c["kind"] == "biggest_expense"
        )
        assert card["subject"] == report.stats["top_expenses"][0]["subject"]
        assert card["value"] == report.stats["top_expenses"][0]["amount"]

    def test_a_month_without_a_single_expense_has_no_money_chapter(self):
        hh = HouseholdFactory()
        make_owner(hh)

        stats = build_stats(hh, "2026-05")

        assert "money" not in stats["generated_for"]

    def test_the_recap_app_never_sums_amounts_itself(self):
        """A ``Sum`` here would be a second definition of the same counter.

        Parsed with ``ast`` rather than grepped, so prose *about* the rule (this
        codebase comments it in several places) never trips the guard.
        """
        assert _called_names_in_app() & {"Sum", "Avg", "Count"} == set()

    def test_the_recap_app_never_reads_the_wall_clock(self):
        """Month bounds come from ``core.timezones``, never from the server clock.

        ``date.today()`` is the server's clock (UTC in a container) and
        ``ZoneInfo(...)`` is the local helper this project deliberately centralized —
        the month bound decides which month an expense belongs to.
        """
        assert _called_names_in_app() & {"today", "localdate", "ZoneInfo"} == set()


# ===========================================================================
# 4. TestABrokenCollectorIsIsolated
# ===========================================================================


@pytest.mark.django_db
class TestABrokenCollectorIsIsolated:
    def test_a_collector_that_raises_does_not_sink_the_recap(self, monkeypatch):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-05")

        def _boom(household, month, *, start, end):
            raise RuntimeError("collector exploded")

        monkeypatch.setattr(
            chapters_module,
            "CHAPTER_SPECS",
            (
                chapters_module.ChapterSpec("boom", None, _boom),
                *chapters_module.CHAPTER_SPECS,
            ),
        )

        stats = build_stats(hh, "2026-05")

        assert "boom" not in stats["generated_for"]
        assert "money" in stats["generated_for"]


# ===========================================================================
# 5. TestChapterGating
# ===========================================================================


@pytest.mark.django_db
class TestChapterGating:
    def test_a_disabled_module_chapter_is_absent_not_empty(self, monkeypatch):
        """Absent, so a household without chickens is never told it could have some."""
        hh = HouseholdFactory()
        hh.disabled_modules = ["chickens"]
        hh.save()

        def _collect(household, month, *, start, end):
            return chapters_module.Chapter(
                "coop", [chapters_module.RecapCard("eggs", {"value": "112"})]
            )

        monkeypatch.setattr(
            chapters_module,
            "CHAPTER_SPECS",
            (chapters_module.ChapterSpec("coop", "chickens", _collect),),
        )

        stats = build_stats(hh, "2026-05")

        assert stats["chapters"] == []
        assert "coop" not in stats["generated_for"]

    def test_an_enabled_module_chapter_is_collected(self, monkeypatch):
        hh = HouseholdFactory()

        def _collect(household, month, *, start, end):
            return chapters_module.Chapter(
                "coop", [chapters_module.RecapCard("eggs", {"value": "112"})]
            )

        monkeypatch.setattr(
            chapters_module,
            "CHAPTER_SPECS",
            (chapters_module.ChapterSpec("coop", "chickens", _collect),),
        )

        stats = build_stats(hh, "2026-05")

        assert stats["generated_for"] == ["coop"]
        assert stats["card_count"] == 1
