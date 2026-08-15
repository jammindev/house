# orchard/tests/test_care_rules.py
"""
Seasonal rules through the API — and the two behaviours that make the design
worth its cost: the due state is **derived**, and a kind-scoped rule is one
state per subject.
"""
from __future__ import annotations

from datetime import date

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from alerts.services import build_alerts_summary
from households.models import HouseholdMember
from orchard import queries, services
from orchard.models import CareRule, Tree, TreeEvent
from zones.models import Zone

from .factories import (
    HouseholdFactory,
    HouseholdMemberFactory,
    TreeFactory,
    UserFactory,
)


def _setup():
    hh = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=hh, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = hh
    user.save(update_fields=["active_household"])
    zone = Zone.objects.create(household=hh, name="Verger", created_by=user)
    return hh, user, zone


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestRuleCrud:
    def test_create_a_winter_rule(self):
        hh, user, zone = _setup()
        response = _client(user).post(
            reverse("orchard-rule-list"),
            {
                "name": "Taille d'hiver", "start_month": 11, "end_month": 3,
                "kind": "fruit_tree", "event_type": "pruning",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        rule = CareRule.objects.get(id=response.data["id"])
        assert (rule.start_month, rule.end_month) == (11, 3)

    def test_a_rule_cannot_target_a_subject_and_a_kind_at_once(self):
        """A rule that is two rules at once cannot be satisfied by one entry."""
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        response = _client(user).post(
            reverse("orchard-rule-list"),
            {
                "name": "Ambiguë", "start_month": 6, "end_month": 8,
                "tree": str(tree.id), "kind": "fruit_tree",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_month_out_of_range_is_refused(self):
        hh, user, zone = _setup()
        response = _client(user).post(
            reverse("orchard-rule-list"),
            {"name": "Impossible", "start_month": 0, "end_month": 13},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_another_household_sees_nothing(self):
        hh, user, zone = _setup()
        services.create_rule(hh, user, name="Taille", start_month=11, end_month=3)
        other_hh, other_user, _ = _setup()
        response = _client(other_user).get(reverse("orchard-rule-list"))
        assert response.data == []


@pytest.mark.django_db
class TestOneStatePerSubject:
    """A kind-scoped rule is not one state — it is one per subject."""

    def test_pruning_one_apple_tree_does_not_settle_the_others(self):
        hh, user, zone = _setup()
        a = TreeFactory(household=hh, zone=zone, created_by=user, name="Pommier A")
        b = TreeFactory(household=hh, zone=zone, created_by=user, name="Pommier B")
        rule = services.create_rule(
            hh, user, name="Taille d'hiver", start_month=11, end_month=3, kind="fruit_tree"
        )

        services.complete_rule(hh, user, rule, a, occurred_on=date(2026, 12, 20))

        states = {
            s["tree"].name: s["state"]
            for s in queries.rule_states(hh, today=date(2027, 1, 15))
        }
        assert states["Pommier A"] == "done"
        assert states["Pommier B"] == "due"

    def test_a_dead_subject_is_not_asked_for_pruning(self):
        hh, user, zone = _setup()
        TreeFactory(
            household=hh, zone=zone, created_by=user, name="Mort", status=Tree.Status.DEAD
        )
        services.create_rule(
            hh, user, name="Taille", start_month=11, end_month=3, kind="fruit_tree"
        )
        states = queries.rule_states(hh, today=date(2026, 12, 1))
        assert states == []


@pytest.mark.django_db
class TestTheDueStateIsDerived:
    """Nothing is stored: deleting the journal entry rolls the state back."""

    def test_completing_then_deleting_the_entry_makes_the_rule_due_again(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        rule = services.create_rule(
            hh, user, name="Taille d'hiver", start_month=11, end_month=3, tree=tree
        )

        event = services.complete_rule(hh, user, rule, tree, occurred_on=date(2026, 12, 20))
        assert queries.rule_states(hh, today=date(2027, 1, 15))[0]["state"] == "done"

        services.delete_event(hh, user, event)
        # No write, no recomputation, no stale date: the state simply comes back.
        assert queries.rule_states(hh, today=date(2027, 1, 15))[0]["state"] == "due"

    def test_no_next_due_column_exists_anywhere(self):
        """The rule of the project, pinned: a derived date that gets stored is a
        date that will diverge."""
        columns = {field.name for field in CareRule._meta.get_fields()}
        assert "next_due_on" not in columns
        assert "last_done_on" not in columns

    def test_a_completion_writes_the_rules_own_event_type(self):
        """« Bouillie bordelaise » must land as a treatment, not as a pruning —
        the journal is filtered by type, so a wrong type makes that filter lie."""
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        rule = services.create_rule(
            hh, user, name="Bouillie bordelaise", start_month=10, end_month=11,
            tree=tree, event_type="treatment",
        )
        event = services.complete_rule(hh, user, rule, tree)
        assert event.type == TreeEvent.Type.TREATMENT
        assert event.care_rule_id == rule.id

    def test_dropping_a_rule_keeps_the_proof_that_the_work_was_done(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        rule = services.create_rule(
            hh, user, name="Taille", start_month=11, end_month=3, tree=tree
        )
        event = services.complete_rule(hh, user, rule, tree, occurred_on=date(2026, 12, 20))

        services.delete_rule(hh, user, rule)

        event.refresh_from_db()
        assert event.care_rule_id is None
        assert TreeEvent.objects.filter(id=event.id).exists()


@pytest.mark.django_db
class TestTheCompleteEndpoint:
    def test_it_writes_the_journal_entry(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        rule = services.create_rule(
            hh, user, name="Taille d'hiver", start_month=11, end_month=3, tree=tree
        )
        response = _client(user).post(
            reverse("orchard-rule-complete", args=[rule.id]),
            {"tree": str(tree.id), "occurred_on": "2026-12-20"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert TreeEvent.objects.filter(care_rule=rule, tree=tree).count() == 1

    def test_completing_on_a_subject_the_rule_does_not_concern_is_refused(self):
        hh, user, zone = _setup()
        apple = TreeFactory(household=hh, zone=zone, created_by=user)
        vine = TreeFactory(
            household=hh, zone=zone, created_by=user, name="Vigne", kind=Tree.Kind.VINE
        )
        rule = services.create_rule(
            hh, user, name="Taille", start_month=11, end_month=3, tree=apple
        )
        response = _client(user).post(
            reverse("orchard-rule-complete", args=[rule.id]),
            {"tree": str(vine.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert TreeEvent.objects.count() == 0


@pytest.mark.django_db
class TestTheSeasonPanelAndTheAlertsAgree:
    """« Un écart ne se dit jamais deux fois avec deux voix » — the panel and the
    alert summary read the same function, so they cannot contradict."""

    def test_both_see_the_same_rows(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        services.create_rule(
            hh, user, name="Taille d'hiver", start_month=1, end_month=12, tree=tree
        )

        panel = _client(user).get(reverse("orchard-rule-season")).data
        summary = build_alerts_summary(hh)

        assert panel["total"] == 1
        assert len(summary["due_orchard_care"]) == 1
        assert summary["due_orchard_care"][0]["title"].startswith("Taille d'hiver")


@pytest.mark.django_db
class TestARuleProposesATaskItNeverInventsAReminder:
    """ORCH-05 — the module adds no fourth definition of « en retard »."""

    def test_it_creates_a_task_due_at_the_end_of_the_window(self):
        from tasks.models import Task

        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user, name="Le gros pommier")
        rule = services.create_rule(
            hh, user, name="Taille d'hiver", start_month=1, end_month=12, tree=tree
        )

        response = _client(user).post(
            reverse("orchard-rule-create-task", args=[rule.id]),
            {"tree": str(tree.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

        task = Task.objects.get(id=response.data["id"])
        assert task.subject == "Taille d'hiver — Le gros pommier"
        # The window's end, not an invented date: the window is what the gesture obeys.
        assert task.due_date == date(task.due_date.year, 12, 31)

    def test_no_task_appears_without_an_explicit_click(self):
        """A rule that manufactures its own occurrences fills the task list with
        things nobody asked for."""
        from tasks.models import Task

        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        services.create_rule(
            hh, user, name="Taille", start_month=1, end_month=12, tree=tree
        )
        _client(user).get(reverse("orchard-rule-season"))
        assert Task.objects.count() == 0
