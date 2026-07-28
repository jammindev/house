# recap/tests/test_chapters.py
"""
Tests for the four non-money chapters (parcours 27 lot 5).

The two regressions that matter, and that nothing else catches:

  * ``TestPrivateTasksNeverCount`` — a snapshot is frozen once for the household and
    read by every member, so anything whose visibility varies by reader must be
    excluded from the *figure*, not filtered at display time.
  * ``TestTheRecapNeverBreaksDownByMember`` — no chapter may ever group by member.
    Chiffrer que l'un en a fait moins que l'autre transforme un moment de fierté en
    dispute, et la personne qui perd désinstalle.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from recap.chapters import collect_achievements, collect_home, collect_memories
from recap.service import build_stats

from .factories import HouseholdFactory, UserFactory, make_owner

MONTH = "2026-05"


def _bounds(household, month=MONTH):
    from budget.report.stats import month_bounds

    return month_bounds(household, month)


def _cards(stats, chapter_key):
    for chapter in stats.get("chapters") or []:
        if chapter["key"] == chapter_key:
            return chapter["cards"]
    return []


def _done_task(household, user, *, subject="Fix the tap", private=False, project=None, when=None):
    from tasks.models import Task

    start, _end = _bounds(household)
    return Task.objects.create(
        household=household,
        subject=subject,
        status=Task.Status.DONE,
        completed_at=when or (start + timedelta(days=4)),
        completed_by=user,
        # A private task is nobody's but its creator's — the DB enforces it
        # (`tasks_private_not_assigned`), so it cannot carry an assignee.
        assigned_to=None if private else user,
        is_private=private,
        project=project,
        created_by=user,
    )


# ===========================================================================
# Achievements
# ===========================================================================


@pytest.mark.django_db
class TestAchievements:
    def test_finished_tasks_are_counted(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _done_task(hh, owner, subject="A")
        _done_task(hh, owner, subject="B")
        start, end = _bounds(hh)

        chapter = collect_achievements(hh, MONTH, start=start, end=end)

        card = next(c for c in chapter.cards if c.kind == "tasks_done")
        assert card.data["count"] == 2

    def test_a_month_without_a_finished_task_has_no_chapter(self):
        hh = HouseholdFactory()
        make_owner(hh)
        start, end = _bounds(hh)

        assert collect_achievements(hh, MONTH, start=start, end=end) is None

    def test_a_task_finished_in_another_month_is_out(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        start, end = _bounds(hh)
        _done_task(hh, owner, when=end + timedelta(days=1))

        assert collect_achievements(hh, MONTH, start=start, end=end) is None

    def test_the_project_that_moved_most_is_named(self):
        from projects.models import Project

        hh = HouseholdFactory()
        owner = make_owner(hh)
        bathroom = Project.objects.create(household=hh, title="Salle de bain", created_by=owner)
        garden = Project.objects.create(household=hh, title="Jardin", created_by=owner)
        _done_task(hh, owner, subject="A", project=bathroom)
        _done_task(hh, owner, subject="B", project=bathroom)
        _done_task(hh, owner, subject="C", project=garden)
        start, end = _bounds(hh)

        chapter = collect_achievements(hh, MONTH, start=start, end=end)

        card = next(c for c in chapter.cards if c.kind == "project_progress")
        assert card.data["name"] == "Salle de bain"
        assert card.data["count"] == 2
        assert card.data["projects"] == 2

    def test_tasks_without_a_project_produce_no_project_card(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _done_task(hh, owner)
        start, end = _bounds(hh)

        chapter = collect_achievements(hh, MONTH, start=start, end=end)

        assert [c.kind for c in chapter.cards] == ["tasks_done"]


# ===========================================================================
# The private-task regression
# ===========================================================================


@pytest.mark.django_db
class TestPrivateTasksNeverCount:
    """A frozen household snapshot cannot contain reader-dependent data.

    The digest may filter private tasks per recipient because it composes a
    throwaway message for one person. The recap is frozen once and read by all —
    so the private task must never enter the figure in the first place.
    """

    def test_a_private_task_is_not_counted(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _done_task(hh, owner, subject="Public", private=False)
        _done_task(hh, owner, subject="Secret", private=True)
        start, end = _bounds(hh)

        chapter = collect_achievements(hh, MONTH, start=start, end=end)

        card = next(c for c in chapter.cards if c.kind == "tasks_done")
        assert card.data["count"] == 1

    def test_a_month_of_only_private_tasks_has_no_chapter(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _done_task(hh, owner, subject="Secret", private=True)
        start, end = _bounds(hh)

        assert collect_achievements(hh, MONTH, start=start, end=end) is None

    def test_a_private_task_never_reaches_the_snapshot(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _done_task(hh, owner, subject="Confidentiel", private=True)

        stats = build_stats(hh, MONTH)

        assert "Confidentiel" not in str(stats)


# ===========================================================================
# The no-leaderboard regression
# ===========================================================================


@pytest.mark.django_db
class TestTheRecapNeverBreaksDownByMember:
    """No chapter may compare members. The figure is collective or it is nothing."""

    def test_no_collector_groups_by_member(self):
        """Parsed, not grepped, so the prose explaining the rule never trips it."""
        import ast
        import pathlib

        import recap

        forbidden = {"assigned_to", "completed_by", "created_by", "logged_by", "user"}
        offenders: list[str] = []

        for path in pathlib.Path(recap.__file__).parent.glob("*.py"):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                name = node.func.attr if isinstance(node.func, ast.Attribute) else None
                if name not in {"values", "values_list", "annotate", "order_by"}:
                    continue
                for arg in node.args:
                    if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                        root = arg.value.lstrip("-").split("__")[0]
                        if root in forbidden:
                            offenders.append(f"{path.name}: {arg.value}")

        assert offenders == []

    def test_two_members_produce_one_collective_figure(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        other = UserFactory()
        _done_task(hh, owner, subject="A")
        _done_task(hh, other, subject="B")
        start, end = _bounds(hh)

        chapter = collect_achievements(hh, MONTH, start=start, end=end)
        card = next(c for c in chapter.cards if c.kind == "tasks_done")

        # One number for the household — no per-member key anywhere in the payload.
        assert card.data == {"count": 2}


# ===========================================================================
# The house
# ===========================================================================


@pytest.mark.django_db
class TestHome:
    def test_eggs_are_totalled_over_the_month(self):
        from chickens.models import EggLog

        hh = HouseholdFactory()
        start, end = _bounds(hh)
        EggLog.objects.create(household=hh, date=start.date(), count=4)
        EggLog.objects.create(household=hh, date=start.date() + timedelta(days=1), count=6)

        chapter = collect_home(hh, MONTH, start=start, end=end)

        card = next(c for c in chapter.cards if c.kind == "eggs")
        assert card.data["value"] == 10
        assert card.data["logged_days"] == 2
        assert card.data["best_day"] == 6

    def test_an_egg_log_from_another_month_is_out(self):
        from chickens.models import EggLog

        hh = HouseholdFactory()
        start, end = _bounds(hh)
        EggLog.objects.create(household=hh, date=end.date() + timedelta(days=3), count=9)

        assert collect_home(hh, MONTH, start=start, end=end) is None

    def test_a_household_without_data_gets_no_card_rather_than_a_zero(self):
        """« 0 kWh » would be a false statement, not an empty one."""
        hh = HouseholdFactory()
        start, end = _bounds(hh)

        assert collect_home(hh, MONTH, start=start, end=end) is None

    def test_a_disabled_module_removes_only_its_own_card(self):
        from chickens.models import EggLog

        hh = HouseholdFactory()
        hh.disabled_modules = ["chickens"]
        hh.save()
        start, end = _bounds(hh)
        EggLog.objects.create(household=hh, date=start.date(), count=4)

        assert collect_home(hh, MONTH, start=start, end=end) is None

    def test_a_failing_meter_does_not_sink_the_chapter(self, monkeypatch):
        from chickens.models import EggLog

        hh = HouseholdFactory()
        start, end = _bounds(hh)
        EggLog.objects.create(household=hh, date=start.date(), count=4)

        import electricity.services as elec

        monkeypatch.setattr(
            elec, "consumption_summary", lambda *a, **k: (_ for _ in ()).throw(RuntimeError())
        )

        chapter = collect_home(hh, MONTH, start=start, end=end)

        assert [c.kind for c in chapter.cards] == ["eggs"]


# ===========================================================================
# Memories
# ===========================================================================


@pytest.mark.django_db
class TestMemories:
    def _photo(self, household, when, name="photo.jpg"):
        from documents.models import Document

        doc = Document.objects.create(
            household=household, name=name, file_path=f"p/{name}", type="photo"
        )
        # ``created_at`` is auto_now_add — a recap reads closed months, so the test
        # has to place the row in the past explicitly.
        Document.objects.filter(pk=doc.pk).update(created_at=when)
        return doc

    def test_photos_of_the_month_are_counted(self):
        hh = HouseholdFactory()
        start, end = _bounds(hh)
        self._photo(hh, start + timedelta(days=2), name="a.jpg")
        self._photo(hh, start + timedelta(days=5), name="b.jpg")

        chapter = collect_memories(hh, MONTH, start=start, end=end)

        card = chapter.cards[0]
        assert card.data["count"] == 2
        assert len(card.data["ids"]) == 2

    def test_the_snapshot_stores_ids_not_urls(self):
        """A signed URL expires; the snapshot is meant to outlive it."""
        hh = HouseholdFactory()
        start, end = _bounds(hh)
        self._photo(hh, start + timedelta(days=2))

        chapter = collect_memories(hh, MONTH, start=start, end=end)

        payload = str(chapter.cards[0].data)
        assert "http" not in payload
        assert "/" not in payload.replace("'ids'", "")

    def test_a_non_photo_document_is_not_a_memory(self):
        from documents.models import Document

        hh = HouseholdFactory()
        start, end = _bounds(hh)
        doc = Document.objects.create(
            household=hh, name="facture.pdf", file_path="p/facture.pdf", type="invoice"
        )
        Document.objects.filter(pk=doc.pk).update(created_at=start + timedelta(days=1))

        assert collect_memories(hh, MONTH, start=start, end=end) is None

    def test_a_photo_deleted_after_the_freeze_breaks_nothing(self):
        from documents.models import Document

        from recap.render import render_chapters

        hh = HouseholdFactory()
        start, end = _bounds(hh)
        doc = self._photo(hh, start + timedelta(days=2))
        stats = build_stats(hh, MONTH)

        Document.objects.filter(pk=doc.pk).delete()

        # The frozen id now points at nothing; the render still stands.
        rendered = render_chapters(stats)
        assert any(c["key"] == "memories" for c in rendered)

    def test_a_month_without_photos_has_no_chapter(self):
        hh = HouseholdFactory()
        start, end = _bounds(hh)

        assert collect_memories(hh, MONTH, start=start, end=end) is None


# ===========================================================================
# All chapters together
# ===========================================================================


@pytest.mark.django_db
class TestTheWholeStory:
    def test_the_chapters_keep_the_registry_order(self):
        from chickens.models import EggLog
        from interactions.services import create_manual_expense_interaction

        hh = HouseholdFactory()
        owner = make_owner(hh)
        start, end = _bounds(hh)

        tz = ZoneInfo(getattr(hh, "timezone", None) or "UTC")
        create_manual_expense_interaction(
            household=hh,
            user=owner,
            subject="Plombier",
            amount=Decimal("180.00"),
            occurred_at=datetime(2026, 5, 15, 12, tzinfo=tz),
        )
        _done_task(hh, owner)
        EggLog.objects.create(household=hh, date=start.date(), count=4)

        stats = build_stats(hh, MONTH)

        assert stats["generated_for"] == ["money", "achievements", "home"]

    def test_the_card_count_matches_what_was_collected(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _done_task(hh, owner)

        stats = build_stats(hh, MONTH)

        assert stats["card_count"] == sum(len(c["cards"]) for c in stats["chapters"])
        assert len(_cards(stats, "achievements")) == 1
