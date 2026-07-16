"""
Unit tests for agent.digest.service — build_digest, render_telegram, active_section_specs.

Covers: aggregation, user disabled_sections, household.disabled_modules, collector
error isolation, is_empty, HTML escaping in render_telegram.

Strategy note: build_digest iterates SECTION_SPECS and calls spec.collect() — direct
function references bound at import time. To inject fake collectors we monkeypatch
agent.digest.collectors.SECTION_SPECS rather than the individual collect_* attributes.
"""
from __future__ import annotations

from datetime import date

import pytest

from agent.digest.collectors import DigestSection, SectionSpec
from agent.digest.service import (
    DigestResult,
    active_section_specs,
    build_digest,
    render_telegram,
)
from chickens.tests.factories import HouseholdFactory, UserFactory, HouseholdMemberFactory
from tasks.tests.factories import TaskFactory


TODAY = date(2026, 7, 16)


def _make_household_and_user():
    household = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user)
    return household, user


def _noop_collect(household, user, *, today):
    return None


def _section_collect(key, emoji, title, lines):
    """Returns a collector that always yields the described section."""
    def _collect(household, user, *, today):
        return DigestSection(key=key, emoji=emoji, title=title, lines=lines)
    return _collect


def _boom_collect(household, user, *, today):
    raise RuntimeError("collector exploded")


def _fake_specs(*specs):
    """Returns a tuple of SectionSpec suitable for monkeypatching SECTION_SPECS."""
    return tuple(specs)


# ---------------------------------------------------------------------------
# active_section_specs
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestActiveSectionSpecs:
    """active_section_specs filters out module-disabled sections."""

    def test_all_modules_enabled_returns_all_specs(self):
        household = HouseholdFactory(disabled_modules=[])
        specs = active_section_specs(household)
        from agent.digest.collectors import SECTION_SPECS
        assert len(specs) == len(SECTION_SPECS)

    def test_disabled_module_excludes_its_spec(self):
        household = HouseholdFactory(disabled_modules=["weather"])
        specs = active_section_specs(household)
        assert all(s.key != "weather" for s in specs)

    def test_tasks_is_core_always_included(self):
        # tasks has module=None — it is never gated
        household = HouseholdFactory(disabled_modules=["weather", "stock", "electricity", "chickens"])
        specs = active_section_specs(household)
        assert any(s.key == "tasks" for s in specs)

    def test_multiple_modules_disabled(self):
        household = HouseholdFactory(disabled_modules=["stock", "chickens"])
        specs = active_section_specs(household)
        keys = {s.key for s in specs}
        assert "stock" not in keys
        assert "chickens" not in keys
        assert "tasks" in keys


# ---------------------------------------------------------------------------
# build_digest
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBuildDigest:
    """build_digest aggregates collectors, respects disabled lists, isolates errors."""

    def test_happy_path_with_real_task(self, monkeypatch):
        """Tasks collector runs against real DB data; other collectors silenced."""
        household, user = _make_household_and_user()
        TaskFactory(
            household=household,
            created_by=user,
            due_date=TODAY,
            status="pending",
        )
        # Replace SECTION_SPECS so only the tasks spec (with real collect_tasks) runs
        import agent.digest.service as svc_mod
        from agent.digest.collectors import SECTION_SPECS
        tasks_spec = next(s for s in SECTION_SPECS if s.key == "tasks")
        monkeypatch.setattr(svc_mod, "SECTION_SPECS", _fake_specs(tasks_spec))
        result = build_digest(household, user, today=TODAY)
        assert not result.is_empty
        assert result.sections[0].key == "tasks"

    def test_user_disabled_section_is_skipped(self, monkeypatch):
        household, user = _make_household_and_user()
        import agent.digest.service as svc_mod
        monkeypatch.setattr(
            svc_mod,
            "SECTION_SPECS",
            _fake_specs(
                SectionSpec("tasks", None, _section_collect("tasks", "✅", "Tasks", ["Do it"])),
            ),
        )
        result = build_digest(
            household, user, today=TODAY, disabled_sections=["tasks"]
        )
        assert result.is_empty

    def test_household_disabled_module_skips_section(self, monkeypatch):
        household, user = _make_household_and_user()
        household.disabled_modules = ["weather"]
        household.save(update_fields=["disabled_modules"])

        call_count = {"n": 0}

        def _weather_spy(h, u, *, today):
            call_count["n"] += 1
            return DigestSection("weather", "⚠️", "Weather", ["Rain"])

        import agent.digest.service as svc_mod
        monkeypatch.setattr(
            svc_mod,
            "SECTION_SPECS",
            _fake_specs(
                SectionSpec("weather", "weather", _weather_spy),
            ),
        )
        build_digest(household, user, today=TODAY)
        # The collector must not have been called because the module is disabled
        assert call_count["n"] == 0

    def test_failing_collector_is_dropped_others_survive(self, monkeypatch):
        household, user = _make_household_and_user()
        import agent.digest.service as svc_mod
        monkeypatch.setattr(
            svc_mod,
            "SECTION_SPECS",
            _fake_specs(
                SectionSpec("tasks", None, _boom_collect),
                SectionSpec("weather", "weather", _section_collect("weather", "⚠️", "Weather", ["Storm"])),
            ),
        )
        result = build_digest(household, user, today=TODAY)
        # weather should still appear despite tasks crashing
        assert not result.is_empty
        assert result.sections[0].key == "weather"

    def test_all_collectors_return_none_is_empty(self, monkeypatch):
        household, user = _make_household_and_user()
        import agent.digest.service as svc_mod
        monkeypatch.setattr(
            svc_mod,
            "SECTION_SPECS",
            _fake_specs(
                SectionSpec("tasks", None, _noop_collect),
                SectionSpec("weather", "weather", _noop_collect),
            ),
        )
        result = build_digest(household, user, today=TODAY)
        assert result.is_empty

    def test_multiple_sections_aggregated(self, monkeypatch):
        household, user = _make_household_and_user()
        import agent.digest.service as svc_mod
        monkeypatch.setattr(
            svc_mod,
            "SECTION_SPECS",
            _fake_specs(
                SectionSpec("tasks", None, _section_collect("tasks", "✅", "Tasks", ["Do it"])),
                SectionSpec("weather", "weather", _section_collect("weather", "⚠️", "Weather", ["Rain"])),
            ),
        )
        result = build_digest(household, user, today=TODAY)
        assert len(result.sections) == 2
        keys = [s.key for s in result.sections]
        assert "tasks" in keys
        assert "weather" in keys

    def test_section_with_empty_lines_excluded(self, monkeypatch):
        """A collector returning a DigestSection with no lines is filtered out."""
        household, user = _make_household_and_user()
        import agent.digest.service as svc_mod
        monkeypatch.setattr(
            svc_mod,
            "SECTION_SPECS",
            _fake_specs(
                SectionSpec("tasks", None, _section_collect("tasks", "✅", "Tasks", [])),
            ),
        )
        result = build_digest(household, user, today=TODAY)
        assert result.is_empty


# ---------------------------------------------------------------------------
# DigestResult.is_empty
# ---------------------------------------------------------------------------

class TestDigestResultIsEmpty:
    """is_empty reflects whether sections list is populated."""

    def test_empty_sections_is_true(self):
        result = DigestResult(sections=[])
        assert result.is_empty is True

    def test_non_empty_sections_is_false(self):
        result = DigestResult(
            sections=[DigestSection("tasks", "✅", "Tasks", ["Do it"])]
        )
        assert result.is_empty is False


# ---------------------------------------------------------------------------
# render_telegram
# ---------------------------------------------------------------------------

class TestRenderTelegram:
    """render_telegram: HTML escaped content, <b> title, correct shape."""

    def _make_result(self, sections):
        return DigestResult(sections=sections)

    def test_section_title_is_bold(self):
        result = self._make_result(
            [DigestSection("tasks", "✅", "My Tasks", ["Do it"])]
        )
        html = render_telegram(result)
        assert "<b>" in html
        assert "My Tasks" in html

    def test_special_chars_in_line_are_escaped(self):
        subject = "Fix <boiler> & heater"
        result = self._make_result(
            [DigestSection("tasks", "✅", "Tasks", [f"Today: {subject}"])]
        )
        html = render_telegram(result)
        assert "<boiler>" not in html
        assert "&lt;boiler&gt;" in html
        assert "&amp;" in html

    def test_special_chars_in_title_are_escaped(self):
        result = self._make_result(
            [DigestSection("tasks", "✅", "Title <with> HTML & stuff", ["line"])]
        )
        html = render_telegram(result)
        assert "<with>" not in html
        assert "&lt;with&gt;" in html

    def test_header_is_bold(self):
        result = self._make_result(
            [DigestSection("tasks", "✅", "Tasks", ["line"])]
        )
        html = render_telegram(result)
        # The leading line must start with a bold header
        assert html.startswith("<b>")

    def test_multiple_sections_all_present(self):
        result = self._make_result([
            DigestSection("tasks", "✅", "Tasks", ["Task 1"]),
            DigestSection("weather", "⚠️", "Weather", ["Storm"]),
        ])
        html = render_telegram(result)
        assert "Tasks" in html
        assert "Weather" in html
        assert "Task 1" in html
        assert "Storm" in html
