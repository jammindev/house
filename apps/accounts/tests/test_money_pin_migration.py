"""The pinned-modules fold (parcours 26, lot 2) — tested as a function, not a run.

A data migration is the one piece of code that executes **once**, on real data,
with nobody watching. Here the failure mode is silent by nature: a user who had
pinned « Dépenses » would simply find their shortcut gone, with nothing to explain
why and no error anywhere.

The migration is not re-run here (it has already been applied by the test database
setup): its transformation is imported and exercised directly, which is what
actually carries the risk. What we check is that it folds, keeps the **position**,
collapses duplicates, and leaves everything else alone.
"""
from __future__ import annotations

import importlib

import pytest

from accounts.serializers import UserSerializer

from .factories import UserFactory

migration = importlib.import_module("accounts.migrations.0014_pinned_modules_money")


class FakeQuerySet:
    """Minimal stand-in for the historical model manager the migration uses."""

    def __init__(self, rows):
        self._rows = rows

    def exclude(self, **kwargs):
        assert kwargs == {"pinned_modules": []}
        return FakeQuerySet([row for row in self._rows if row.pinned_modules])

    def iterator(self):
        return iter(self._rows)


class FakeRow:
    def __init__(self, pinned_modules):
        self.pinned_modules = pinned_modules
        self.saved_fields = None

    def save(self, update_fields=None):
        self.saved_fields = update_fields


class FakeApps:
    def __init__(self, rows):
        self._rows = rows

    def get_model(self, app_label, model_name):
        assert (app_label, model_name) == ("accounts", "User")
        return type("User", (), {"objects": FakeQuerySet(self._rows)})


def fold(pinned: list[str]) -> list[str]:
    row = FakeRow(list(pinned))
    migration.fold_into_money(FakeApps([row]), None)
    return row.pinned_modules


class TestFoldIntoMoney:
    def test_each_legacy_key_becomes_money(self):
        assert fold(["banking"]) == ["money"]
        assert fold(["expenses"]) == ["money"]
        assert fold(["budget"]) == ["money"]

    def test_position_is_preserved(self):
        """A user who had « Dépenses » at the top finds « Argent » at the top."""
        assert fold(["expenses", "tasks", "stock"]) == ["money", "tasks", "stock"]
        assert fold(["tasks", "budget"]) == ["tasks", "money"]

    def test_two_of_the_three_collapse_into_one_entry(self):
        assert fold(["banking", "tasks", "budget"]) == ["money", "tasks"]

    def test_other_keys_are_untouched(self):
        assert fold(["tasks", "stock", "chickens"]) == ["tasks", "stock", "chickens"]

    def test_an_already_folded_list_is_left_alone(self):
        """Idempotence matters: a re-run must not duplicate or reorder anything."""
        assert fold(["money", "tasks"]) == ["money", "tasks"]

    def test_a_row_without_legacy_keys_is_not_saved(self):
        row = FakeRow(["tasks"])
        migration.fold_into_money(FakeApps([row]), None)
        assert row.saved_fields is None

    def test_a_folded_row_is_saved_on_the_narrow_field(self):
        row = FakeRow(["budget"])
        migration.fold_into_money(FakeApps([row]), None)
        assert row.saved_fields == ["pinned_modules"]


class TestUnfold:
    def test_money_becomes_expenses(self):
        """Rollback is best effort: which of the three it was is not recoverable,
        and `expenses` was core (so always visible) unlike `banking`."""
        row = FakeRow(["money", "tasks"])
        migration.unfold_from_money(FakeApps([row]), None)
        assert row.pinned_modules == ["expenses", "tasks"]


@pytest.mark.django_db
class TestSerializerAgreesWithTheMigration:
    def test_money_is_accepted(self):
        """The migration writes `money`; the serializer must not then reject it on
        the next ordinary PATCH — that would lock the user out of their own pins."""
        user = UserFactory()
        serializer = UserSerializer(user, data={"pinned_modules": ["money"]}, partial=True)
        assert serializer.is_valid(), serializer.errors

    @pytest.mark.parametrize("legacy", ["banking", "expenses", "budget"])
    def test_legacy_keys_are_refused(self, legacy):
        user = UserFactory()
        serializer = UserSerializer(user, data={"pinned_modules": [legacy]}, partial=True)
        assert not serializer.is_valid()
        assert "pinned_modules" in serializer.errors
