"""The « Argent » module key contract (parcours 26 lot 2, then issue #562).

Moving navigation entries around is the risky half of such a change, and the risk
is not visual: it is **stored configuration that stops matching anything**. Two
things have to hold, and nothing else in the suite checks them.

1. The registries agree with the frontend one (`ui/src/lib/modules.ts`). A key that
   exists on one side only produces either an invisible module or a 400 on a
   perfectly ordinary PATCH — and the 400 lands on a user who merely toggled a pin,
   because the frontend sends back the whole stored list.
2. The family is **core**. It cannot be optional: a household switching it off would
   lose expenses and budgets, which were never switchable. That is the whole reason
   bank accounts stopped being an opt-in.
"""
from __future__ import annotations

import importlib

import pytest

from households.modules import LEGACY_MONEY_MODULES, OPTIONAL_MODULES, PINNABLE_MODULES


MONEY_PAGES = ("money_budgets", "money_expenses", "money_accounts")


class TestModuleRegistries:
    @pytest.mark.parametrize("key", MONEY_PAGES)
    def test_each_money_page_is_pinnable(self, key):
        assert key in PINNABLE_MODULES

    @pytest.mark.parametrize("key", MONEY_PAGES)
    def test_no_money_page_is_optional(self, key):
        """Core by necessity, not by taste — see the module docstring."""
        assert key not in OPTIONAL_MODULES

    @pytest.mark.parametrize("legacy", sorted(LEGACY_MONEY_MODULES))
    def test_legacy_keys_are_gone_from_both_registries(self, legacy):
        assert legacy not in PINNABLE_MODULES
        assert legacy not in OPTIONAL_MODULES

    def test_legacy_set_names_every_retired_money_key(self):
        assert LEGACY_MONEY_MODULES == {"banking", "expenses", "budget", "money"}


migration = importlib.import_module("households.migrations.0011_retire_banking_module_key")


class FakeQuerySet:
    """Minimal stand-in for the historical model manager the migration uses."""

    def __init__(self, rows):
        self._rows = rows

    def exclude(self, **kwargs):
        assert kwargs == {"disabled_modules": []}
        return FakeQuerySet([row for row in self._rows if row.disabled_modules])

    def iterator(self):
        return iter(self._rows)


class FakeRow:
    def __init__(self, disabled_modules):
        self.disabled_modules = disabled_modules
        self.saved_fields = None

    def save(self, update_fields=None):
        self.saved_fields = update_fields


class FakeApps:
    def __init__(self, rows):
        self._rows = rows

    def get_model(self, app_label, model_name):
        assert (app_label, model_name) == ("households", "Household")
        return type("Household", (), {"objects": FakeQuerySet(self._rows)})


class TestDropBankingKey:
    """A dead key in ``disabled_modules`` is an orphan of configuration.

    It maps to no module, nothing reads it, and the next person to open the field
    finds a value they cannot explain. Removing it is the same rule the whole
    parcours applies to data: no silent leftovers.
    """

    def _run(self, disabled: list[str]) -> FakeRow:
        row = FakeRow(list(disabled))
        migration.drop_banking_key(FakeApps([row]), None)
        return row

    def test_banking_is_removed(self):
        assert self._run(["banking"]).disabled_modules == []

    def test_other_keys_survive_in_order(self):
        row = self._run(["stock", "banking", "chickens"])
        assert row.disabled_modules == ["stock", "chickens"]

    def test_a_household_without_banking_is_not_saved(self):
        row = self._run(["stock"])
        assert row.saved_fields is None
        assert row.disabled_modules == ["stock"]

    def test_a_cleaned_household_is_saved_on_the_narrow_field(self):
        assert self._run(["banking"]).saved_fields == ["disabled_modules"]

    def test_rerunning_changes_nothing(self):
        row = FakeRow(["stock"])
        apps = FakeApps([row])
        migration.drop_banking_key(apps, None)
        migration.drop_banking_key(apps, None)
        assert row.disabled_modules == ["stock"]
