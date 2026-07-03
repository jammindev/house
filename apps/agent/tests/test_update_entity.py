"""Tests for the ``update_entity`` tool (tasks + notes, undo payload)."""
from __future__ import annotations

from datetime import date

import pytest
from django.utils import timezone

from accounts.tests.factories import UserFactory
from agent import tools
from interactions.models import Interaction
from tasks.models import Task


@pytest.fixture
def owner(db):
    return UserFactory(email="agent-update-owner@example.com")


def _update(household, tool_input, user=None):
    return tools.dispatch("update_entity", tool_input, household=household, user=user)


def _make_task(household, owner, **overrides):
    payload = dict(household=household, created_by=owner, subject="Purger la VMC")
    payload.update(overrides)
    return Task.objects.create(**payload)


def _make_note(household, owner, **overrides):
    payload = dict(
        household=household, created_by=owner, subject="Ma note",
        content="corps", type="note", occurred_at=timezone.now(),
    )
    payload.update(overrides)
    return Interaction.objects.create(**payload)


class TestResolution:
    def test_unknown_entity_type_is_recoverable(self, household, owner):
        result = _update(
            household, {"entity_type": "dragon", "id": "x", "fields": {"subject": "y"}}
        )
        assert "cannot update 'dragon'" in result.rendered
        assert "note" in result.rendered and "task" in result.rendered

    def test_missing_id_is_recoverable(self, household, owner):
        result = _update(household, {"entity_type": "task", "fields": {"subject": "y"}})
        assert "needs both entity_type and id" in result.rendered

    def test_malformed_id_is_recoverable(self, household, owner):
        result = _update(
            household,
            {"entity_type": "task", "id": "pas-un-uuid", "fields": {"subject": "y"}},
        )
        assert "invalid id" in result.rendered

    def test_cross_household_task_is_not_found(self, household, other_household, owner):
        foreign = _make_task(other_household, owner)
        result = _update(
            household,
            {"entity_type": "task", "id": str(foreign.pk), "fields": {"subject": "y"}},
            user=owner,
        )
        assert "no task found" in result.rendered
        foreign.refresh_from_db()
        assert foreign.subject == "Purger la VMC"

    def test_no_updatable_field_is_recoverable(self, household, owner):
        task = _make_task(household, owner)
        result = _update(
            household,
            {"entity_type": "task", "id": str(task.pk), "fields": {"assigned_to_id": "1"}},
            user=owner,
        )
        assert "no updatable field" in result.rendered


class TestTaskUpdate:
    def test_mark_done_sets_completion_and_returns_undo_payload(self, household, owner):
        task = _make_task(household, owner, status="pending")
        result = _update(
            household,
            {"entity_type": "task", "id": str(task.pk), "fields": {"status": "done"}},
            user=owner,
        )
        task.refresh_from_db()
        assert task.status == "done"
        assert task.completed_at is not None
        assert task.completed_by_id == owner.id

        assert len(result.updated) == 1
        payload = result.updated[0]
        assert payload["entity_type"] == "task"
        assert payload["id"] == str(task.pk)
        assert payload["previous"] == {"status": "pending"}
        assert payload["changed"] == {"status": "done"}
        assert payload["url_path"] == f"/app/tasks/{task.pk}"

    def test_reopening_clears_completion(self, household, owner):
        task = _make_task(
            household, owner, status="done",
            completed_at=timezone.now(), completed_by=owner,
        )
        _update(
            household,
            {"entity_type": "task", "id": str(task.pk), "fields": {"status": "pending"}},
            user=owner,
        )
        task.refresh_from_db()
        assert task.completed_at is None
        assert task.completed_by_id is None

    def test_due_date_change_snapshots_previous_value(self, household, owner):
        task = _make_task(household, owner, due_date=date(2026, 7, 10))
        result = _update(
            household,
            {"entity_type": "task", "id": str(task.pk), "fields": {"due_date": "2026-07-20"}},
            user=owner,
        )
        payload = result.updated[0]
        assert payload["previous"] == {"due_date": "2026-07-10"}
        assert payload["changed"] == {"due_date": "2026-07-20"}

    def test_invalid_status_is_recoverable(self, household, owner):
        task = _make_task(household, owner)
        result = _update(
            household,
            {"entity_type": "task", "id": str(task.pk), "fields": {"status": "wip"}},
            user=owner,
        )
        assert "could not update task" in result.rendered
        task.refresh_from_db()
        assert task.status == "pending"

    def test_random_member_cannot_update_someone_elses_task(self, household, owner):
        stranger = UserFactory(email="stranger-update@example.com")
        task = _make_task(household, owner)
        result = _update(
            household,
            {"entity_type": "task", "id": str(task.pk), "fields": {"subject": "pirate"}},
            user=stranger,
        )
        assert "could not update task" in result.rendered
        task.refresh_from_db()
        assert task.subject == "Purger la VMC"

    def test_assignee_can_only_change_status(self, household, owner):
        assignee = UserFactory(email="assignee-update@example.com")
        task = _make_task(household, owner, assigned_to=assignee)
        blocked = _update(
            household,
            {"entity_type": "task", "id": str(task.pk), "fields": {"subject": "autre"}},
            user=assignee,
        )
        assert "could not update task" in blocked.rendered

        allowed = _update(
            household,
            {"entity_type": "task", "id": str(task.pk), "fields": {"status": "done"}},
            user=assignee,
        )
        assert allowed.updated
        task.refresh_from_db()
        assert task.status == "done"

    def test_updated_item_is_citable(self, household, owner):
        task = _make_task(household, owner)
        result = _update(
            household,
            {"entity_type": "task", "id": str(task.pk), "fields": {"subject": "Nouveau"}},
            user=owner,
        )
        assert [h.id for h in result.hits] == [task.pk]
        assert result.hits[0].entity_type == "task"


class TestNoteUpdate:
    def test_updates_subject_and_content(self, household, owner):
        note = _make_note(household, owner)
        result = _update(
            household,
            {
                "entity_type": "note",
                "id": str(note.pk),
                "fields": {"subject": "Titre revu", "content": "nouveau corps"},
            },
            user=owner,
        )
        note.refresh_from_db()
        assert note.subject == "Titre revu"
        assert note.content == "nouveau corps"
        payload = result.updated[0]
        assert payload["previous"] == {"subject": "Ma note", "content": "corps"}

    def test_non_note_interaction_is_not_updatable(self, household, owner):
        expense = Interaction.objects.create(
            household=household, created_by=owner, subject="Achat",
            type="expense", occurred_at=timezone.now(),
        )
        result = _update(
            household,
            {"entity_type": "note", "id": str(expense.pk), "fields": {"subject": "x"}},
            user=owner,
        )
        assert "no note found" in result.rendered
        expense.refresh_from_db()
        assert expense.subject == "Achat"

    def test_private_note_of_another_user_is_rejected(self, household, owner):
        stranger = UserFactory(email="note-stranger@example.com")
        note = _make_note(household, owner, is_private=True)
        result = _update(
            household,
            {"entity_type": "note", "id": str(note.pk), "fields": {"subject": "pirate"}},
            user=stranger,
        )
        assert "could not update note" in result.rendered
        note.refresh_from_db()
        assert note.subject == "Ma note"

    def test_blank_subject_is_rejected(self, household, owner):
        note = _make_note(household, owner)
        result = _update(
            household,
            {"entity_type": "note", "id": str(note.pk), "fields": {"subject": "   "}},
            user=owner,
        )
        assert "could not update note" in result.rendered
