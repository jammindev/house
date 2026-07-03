"""Tests for the ``list_entities`` tool (structured listing + aggregation)."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from django.utils import timezone

from accounts.tests.factories import UserFactory
from agent import tools
from interactions.models import Interaction
from tasks.models import Task


@pytest.fixture
def owner(db):
    return UserFactory(email="agent-list-owner@example.com")


def _list(household, tool_input, user=None):
    return tools.dispatch("list_entities", tool_input, household=household, user=user)


def _make_task(household, owner, **overrides):
    payload = dict(household=household, created_by=owner, subject="Purger la VMC")
    payload.update(overrides)
    return Task.objects.create(**payload)


def _make_expense(household, owner, amount, **overrides):
    payload = dict(
        household=household,
        created_by=owner,
        subject="Achat",
        type="expense",
        occurred_at=timezone.now(),
        metadata={"kind": "manual", "amount": str(amount)},
    )
    payload.update(overrides)
    return Interaction.objects.create(**payload)


class TestResolution:
    def test_unknown_entity_type_is_recoverable(self, household):
        result = _list(household, {"entity_type": "dragon"})
        assert "cannot list 'dragon'" in result.rendered
        assert "task" in result.rendered and "interaction" in result.rendered

    def test_filters_must_be_an_object(self, household):
        result = _list(household, {"entity_type": "task", "filters": "status=done"})
        assert "filters must be an object" in result.rendered


class TestTaskListing:
    def test_lists_tasks_with_total_and_citable_hits(self, household, owner):
        t1 = _make_task(household, owner, subject="Tâche A")
        t2 = _make_task(household, owner, subject="Tâche B")
        result = _list(household, {"entity_type": "task"})
        assert "total=2 (showing 2)" in result.rendered
        assert f"id=task:{t1.pk}" in result.rendered
        assert f"id=task:{t2.pk}" in result.rendered
        assert {h.id for h in result.hits} == {t1.pk, t2.pk}

    def test_status_filter(self, household, owner):
        _make_task(household, owner, subject="Faite", status="done")
        pending = _make_task(household, owner, subject="En cours", status="pending")
        result = _list(household, {"entity_type": "task", "filters": {"status": "pending"}})
        assert "total=1" in result.rendered
        assert f"id=task:{pending.pk}" in result.rendered

    def test_overdue_filter(self, household, owner):
        late = _make_task(
            household, owner, subject="En retard",
            due_date=date.today() - timedelta(days=3), status="pending",
        )
        _make_task(
            household, owner, subject="Faite en retard",
            due_date=date.today() - timedelta(days=3), status="done",
        )
        _make_task(
            household, owner, subject="Future",
            due_date=date.today() + timedelta(days=3), status="pending",
        )
        result = _list(household, {"entity_type": "task", "filters": {"overdue": "true"}})
        assert "total=1" in result.rendered
        assert f"id=task:{late.pk}" in result.rendered

    def test_invalid_filter_value_is_recoverable(self, household, owner):
        result = _list(
            household, {"entity_type": "task", "filters": {"due_before": "pas-une-date"}}
        )
        assert "invalid value" in result.rendered
        assert "due_before" in result.rendered

    def test_unknown_status_is_recoverable(self, household, owner):
        result = _list(household, {"entity_type": "task", "filters": {"status": "wip"}})
        assert "invalid value" in result.rendered

    def test_unknown_filter_is_ignored_and_noted(self, household, owner):
        _make_task(household, owner)
        result = _list(household, {"entity_type": "task", "filters": {"couleur": "bleu"}})
        assert "ignored unknown filters: couleur" in result.rendered
        assert "total=1" in result.rendered

    def test_limit_caps_shown_items_but_not_total(self, household, owner):
        for i in range(4):
            _make_task(household, owner, subject=f"Tâche {i}")
        result = _list(household, {"entity_type": "task", "limit": 2})
        assert "total=4 (showing 2)" in result.rendered
        assert len(result.hits) == 2

    def test_scoped_to_household(self, household, other_household, owner):
        _make_task(other_household, owner, subject="Ailleurs")
        result = _list(household, {"entity_type": "task"})
        assert "total=0" in result.rendered
        assert "no items matched" in result.rendered

    def test_output_is_wrapped_in_data_delimiters(self, household, owner):
        _make_task(household, owner)
        result = _list(household, {"entity_type": "task"})
        assert result.rendered.startswith("<household_data>")
        assert result.rendered.endswith("</household_data>")


class TestInteractionAggregation:
    def test_sum_amount_covers_the_whole_filtered_set(self, household, owner):
        _make_expense(household, owner, "100.50")
        _make_expense(household, owner, "49.50")
        _make_expense(household, owner, "10.00")
        # limit=1 shows one item but the sum covers all three.
        result = _list(
            household,
            {"entity_type": "interaction", "filters": {"type": "expense"}, "limit": 1},
        )
        assert "total=3 (showing 1)" in result.rendered
        assert "sum_amount=160.00 (over 3 items with an amount)" in result.rendered

    def test_items_without_amount_are_excluded_from_the_sum(self, household, owner):
        _make_expense(household, owner, "25.00")
        Interaction.objects.create(
            household=household, created_by=owner, subject="Note",
            type="note", occurred_at=timezone.now(),
        )
        result = _list(household, {"entity_type": "interaction"})
        assert "total=2" in result.rendered
        assert "sum_amount=25.00 (over 1 items with an amount)" in result.rendered

    def test_occurred_date_filters(self, household, owner):
        old = _make_expense(
            household, owner, "5.00",
            occurred_at=timezone.now() - timedelta(days=400),
        )
        recent = _make_expense(household, owner, "7.00")
        cutoff = (timezone.now() - timedelta(days=30)).date().isoformat()
        result = _list(
            household,
            {"entity_type": "interaction", "filters": {"occurred_after": cutoff}},
        )
        assert f"id=interaction:{recent.pk}" in result.rendered
        assert f"id=interaction:{old.pk}" not in result.rendered
        assert "sum_amount=7.00" in result.rendered

    def test_describe_includes_type_and_amount(self, household, owner):
        _make_expense(household, owner, "42.00", metadata={"amount": "42.00", "supplier": "Leroy"})
        result = _list(household, {"entity_type": "interaction"})
        assert "expense" in result.rendered
        assert "amount 42.00" in result.rendered
        assert "Leroy" in result.rendered
