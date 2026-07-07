"""Lot 9d — inline undo buttons + callback_query handling."""
from __future__ import annotations

from unittest import mock

import pytest

from agent.service import AnswerResult
from telegram import service
from telegram.rendering import parse_undo_callback, undo_keyboard

from .conftest import WEBHOOK_SECRET

pytestmark = pytest.mark.django_db


# --- pure rendering helpers (no DB) -----------------------------------------


class TestUndoKeyboard:
    def test_button_per_undoable_entity(self):
        created = [
            {"entity_type": "task", "id": "7", "label": "VMC"},
            {"entity_type": "note", "id": "9", "label": "Idée"},
        ]
        kb = undo_keyboard(created, lambda e: f"Undo {e['label']}")
        assert kb == {
            "inline_keyboard": [
                [{"text": "Undo VMC", "callback_data": "undo:task:7"}],
                [{"text": "Undo Idée", "callback_data": "undo:note:9"}],
            ]
        }

    def test_non_undoable_entity_is_skipped(self):
        created = [{"entity_type": "mystery", "id": "1", "label": "x"}]
        assert undo_keyboard(created, lambda e: "u") is None

    def test_empty_created_gives_no_keyboard(self):
        assert undo_keyboard([], lambda e: "u") is None
        assert undo_keyboard(None, lambda e: "u") is None


class TestParseCallback:
    def test_valid(self):
        assert parse_undo_callback("undo:task:42") == ("task", "42")

    def test_id_with_colon_uuid(self):
        assert parse_undo_callback("undo:note:ab:cd") == ("note", "ab:cd")

    def test_invalid(self):
        for bad in ("", "task:42", "undo:task:", "undo::42", "other:task:42"):
            assert parse_undo_callback(bad) is None


# --- backend undo dispatch ---------------------------------------------------


class TestDeleteCreated:
    def test_task_undo_archives(self, db, household, user):
        from agent import writables
        from tasks.services import create_task

        task = create_task(household, user, subject="Purger la VMC")
        writables.delete_created("task", household, user, str(task.pk))
        task.refresh_from_db()
        assert task.status == "archived"

    def test_note_undo_deletes(self, db, household, user):
        from agent import writables
        from interactions.models import Interaction
        from interactions.services import create_note_interaction

        note = create_note_interaction(household=household, user=user, subject="Idée", content="")
        writables.delete_created("note", household, user, str(note.pk))
        assert not Interaction.objects.filter(pk=note.pk).exists()

    def test_missing_item_raises_lookup(self, db, household, user):
        from agent import writables

        with pytest.raises(LookupError):
            writables.delete_created("task", household, user, "00000000-0000-0000-0000-000000000000")

    def test_non_undoable_type_raises_lookup(self, db, household, user):
        from agent import writables

        with pytest.raises(LookupError):
            writables.delete_created("nope", household, user, "1")


# --- callback_query end to end ----------------------------------------------


def _callback(chat_id: int, data: str, *, from_id: int | None = None, update_id: int = 1) -> dict:
    return {
        "update_id": update_id,
        "callback_query": {
            "id": "cbq-1",
            "from": {"id": from_id if from_id is not None else chat_id},
            "message": {"message_id": 55, "chat": {"id": chat_id}},
            "data": data,
        },
    }


class TestCallbackQuery:
    def test_undo_archives_and_edits_message(self, bot, linked_account, household, user):
        from tasks.services import create_task

        task = create_task(household, user, subject="Purger la VMC")
        service.handle_update(_callback(linked_account.chat_id, f"undo:task:{task.pk}"))

        task.refresh_from_db()
        assert task.status == "archived"
        bot.answer_callback_query.assert_called_once()
        bot.edit_message_reply_markup.assert_called_once_with(linked_account.chat_id, 55)

    def test_double_tap_is_idempotent(self, bot, linked_account, household, user):
        from tasks.services import create_task

        task = create_task(household, user, subject="X")
        cb = _callback(linked_account.chat_id, f"undo:task:{task.pk}")
        service.handle_update(cb)
        service.handle_update({**cb, "update_id": 2})
        # Both calls acknowledge; the task is archived once, no crash.
        assert bot.answer_callback_query.call_count == 2

    def test_foreign_sender_cannot_undo(self, bot, linked_account, household, user):
        from tasks.services import create_task

        task = create_task(household, user, subject="Secret")
        # Same chat, but the tap claims to come from a different Telegram user.
        service.handle_update(
            _callback(linked_account.chat_id, f"undo:task:{task.pk}", from_id=424242)
        )
        task.refresh_from_db()
        assert task.status != "archived"

    def test_unlinked_chat_callback_is_ignored(self, bot, db):
        service.handle_update(_callback(999999, "undo:task:1"))
        bot.edit_message_reply_markup.assert_not_called()

    def test_malformed_callback_is_acknowledged(self, bot, linked_account):
        service.handle_update(_callback(linked_account.chat_id, "garbage"))
        bot.answer_callback_query.assert_called_once()
        bot.edit_message_reply_markup.assert_not_called()


class TestAnswerCarriesKeyboard:
    def test_created_entity_attaches_undo_button(self, bot, monkeypatch, linked_account, household, user, settings):
        monkeypatch.setattr(service, "_spawn", lambda target, *args: target(*args))
        from tasks.services import create_task

        task = create_task(household, user, subject="Nouvelle tâche")
        result = AnswerResult(
            answer="C'est noté.",
            citations=[],
            metadata={
                "model": "m",
                "created_entities": [
                    {"entity_type": "task", "id": str(task.pk), "label": "Nouvelle tâche", "url_path": f"/app/tasks/{task.pk}"}
                ],
            },
        )
        monkeypatch.setattr("agent.service.ask", mock.Mock(return_value=result))
        service.handle_update({
            "update_id": 1,
            "message": {
                "message_id": 1,
                "chat": {"id": linked_account.chat_id},
                "from": {"id": linked_account.chat_id, "language_code": "fr"},
                "text": "ajoute une tâche",
            },
        })
        last_call = bot.send_message.call_args
        keyboard = last_call.kwargs["reply_markup"]
        assert keyboard["inline_keyboard"][0][0]["callback_data"] == f"undo:task:{task.pk}"


def test_secret_present():
    assert WEBHOOK_SECRET
