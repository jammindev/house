"""
Tests for the trackers agent integration — parcours 11, lot 5.

Covers:
  - create_entity / tracker via dispatch (WritableSpec) — same write path as REST
  - anchor handling: anchored project → project
  - create_entity / tracker_entry: by name, by id, anchored-tracker fallback,
    single-tracker fallback, error paths
  - update_entity / tracker_entry (fix a wrong reading) and / tracker
  - list_entities / tracker with project & general filters
  - SearchableSpec: entries_summary is part of the search fields (RAG bridge)
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from accounts.tests.factories import UserFactory
from agent import tools
from agent.searchables import find_spec
from households.models import Household, HouseholdMember
from projects.models import Project
from trackers import services
from trackers.models import Tracker, TrackerEntry

from .factories import TrackerFactory


def _dispatch(name, household, tool_input, user=None, context_entity=None):
    kwargs = {"household": household, "user": user}
    if context_entity is not None:
        kwargs["context_entity"] = context_entity
    return tools.dispatch(name, tool_input, **kwargs)


@pytest.fixture
def owner(db):
    return UserFactory(email="trackers-agent@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Trackers Agent House")
    HouseholdMember.objects.create(user=owner, household=hh, role=HouseholdMember.Role.OWNER)
    return hh


# ── create_entity / tracker ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateTrackerViaAgent:
    def test_create_matches_rest_write_path(self, household, owner):
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker", "fields": {"name": "Compteur d'eau", "unit": "m³"}},
            user=owner,
        )
        assert result.created and result.created[0]["entity_type"] == "tracker"
        tracker = Tracker.objects.get(pk=result.created[0]["id"])
        # Same result shape as the REST/service path (validation, scoping, audit).
        assert tracker.household == household
        assert tracker.created_by == owner
        assert tracker.unit == "m³"
        assert result.created[0]["url_path"] == f"/app/trackers/{tracker.id}"

    def test_anchored_project_prefills_project(self, household, owner):
        project = Project.objects.create(household=household, title="Réno", created_by=owner)
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker", "fields": {"name": "Budget peinture", "unit": "€"}},
            user=owner,
            context_entity=("project", str(project.id)),
        )
        tracker = Tracker.objects.get(pk=result.created[0]["id"])
        assert tracker.project == project

    def test_missing_name_is_recoverable(self, household, owner):
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker", "fields": {"unit": "m³"}},
            user=owner,
        )
        assert not result.created
        assert "could not create tracker" in result.rendered


# ── create_entity / tracker_entry ────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateEntryViaAgent:
    def test_create_by_tracker_name(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner, name="Compteur d'eau")
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker_entry", "fields": {"tracker": "compteur", "value": "148.2"}},
            user=owner,
        )
        assert result.created and result.created[0]["entity_type"] == "tracker_entry"
        entry = TrackerEntry.objects.get(pk=result.created[0]["id"])
        assert entry.tracker == tracker
        assert entry.value == Decimal("148.2")
        # Cache refreshed through the shared service path.
        tracker.refresh_from_db()
        assert tracker.last_value == Decimal("148.2")
        assert "148.2" in tracker.entries_summary

    def test_label_carries_tracker_name_and_unit(self, household, owner):
        TrackerFactory(household=household, created_by=owner, name="Compteur d'eau", unit="m³")
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker_entry", "fields": {"value": "148.2"}},
            user=owner,
        )
        assert result.created[0]["label"] == "Compteur d'eau : 148.2 m³"

    def test_anchored_tracker_fallback(self, household, owner):
        # Two trackers exist — the anchor removes the ambiguity.
        target = TrackerFactory(household=household, created_by=owner, name="Poids")
        TrackerFactory(household=household, created_by=owner, name="Compteur")
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker_entry", "fields": {"value": "82.4"}},
            user=owner,
            context_entity=("tracker", str(target.id)),
        )
        entry = TrackerEntry.objects.get(pk=result.created[0]["id"])
        assert entry.tracker == target

    def test_single_tracker_fallback_without_name(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker_entry", "fields": {"value": "3"}},
            user=owner,
        )
        assert TrackerEntry.objects.get(pk=result.created[0]["id"]).tracker == tracker

    def test_ambiguous_tracker_is_recoverable(self, household, owner):
        TrackerFactory(household=household, created_by=owner, name="A")
        TrackerFactory(household=household, created_by=owner, name="B")
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker_entry", "fields": {"value": "1"}},
            user=owner,
        )
        assert not result.created
        assert "several trackers" in result.rendered

    def test_unknown_tracker_is_recoverable(self, household, owner):
        TrackerFactory(household=household, created_by=owner, name="Compteur")
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker_entry", "fields": {"tracker": "piscine", "value": "1"}},
            user=owner,
        )
        assert not result.created
        assert "unknown tracker" in result.rendered

    def test_missing_value_is_recoverable(self, household, owner):
        TrackerFactory(household=household, created_by=owner)
        result = _dispatch(
            "create_entity", household,
            {"entity_type": "tracker_entry", "fields": {}},
            user=owner,
        )
        assert not result.created
        assert "value is required" in result.rendered

    def test_backdated_entry_via_occurred_at(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        result = _dispatch(
            "create_entity", household,
            {
                "entity_type": "tracker_entry",
                "fields": {"value": "140", "occurred_at": "2026-06-01T08:30:00Z"},
            },
            user=owner,
        )
        entry = TrackerEntry.objects.get(pk=result.created[0]["id"])
        assert entry.occurred_at.year == 2026 and entry.occurred_at.month == 6
        assert entry.tracker == tracker


# ── update_entity ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUpdateViaAgent:
    def test_fix_entry_value_refreshes_cache(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner)
        entry = services.add_entry(household, owner, tracker, value="10")
        result = _dispatch(
            "update_entity", household,
            {
                "entity_type": "tracker_entry",
                "id": str(entry.id),
                "fields": {"value": "12.5"},
            },
            user=owner,
        )
        assert result.updated and result.updated[0]["previous"]["value"] == "10.000"
        tracker.refresh_from_db()
        assert tracker.last_value == Decimal("12.5")

    def test_rename_tracker(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner, name="Avant")
        result = _dispatch(
            "update_entity", household,
            {"entity_type": "tracker", "id": str(tracker.id), "fields": {"name": "Après"}},
            user=owner,
        )
        assert result.updated
        tracker.refresh_from_db()
        assert tracker.name == "Après"


# ── list_entities / tracker ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestListTrackersViaAgent:
    def test_list_with_describe(self, household, owner):
        tracker = TrackerFactory(household=household, created_by=owner, name="Compteur", unit="m³")
        services.add_entry(household, owner, tracker, value="148.2")
        result = _dispatch(
            "list_entities", household, {"entity_type": "tracker"}, user=owner
        )
        assert "Compteur" in result.rendered
        assert "148.2 m³" in result.rendered

    def test_filter_general(self, household, owner):
        project = Project.objects.create(household=household, title="Réno", created_by=owner)
        TrackerFactory(household=household, created_by=owner, name="Général")
        TrackerFactory(household=household, created_by=owner, name="Projet", project=project)
        result = _dispatch(
            "list_entities", household,
            {"entity_type": "tracker", "filters": {"general": "true"}},
            user=owner,
        )
        assert "Général" in result.rendered
        assert "Projet" not in result.rendered

    def test_filter_project(self, household, owner):
        project = Project.objects.create(household=household, title="Réno", created_by=owner)
        TrackerFactory(household=household, created_by=owner, name="Général")
        TrackerFactory(household=household, created_by=owner, name="Budget", project=project)
        result = _dispatch(
            "list_entities", household,
            {"entity_type": "tracker", "filters": {"project": str(project.id)}},
            user=owner,
        )
        assert "Budget" in result.rendered
        assert "Général" not in result.rendered


# ── SearchableSpec (RAG bridge) ──────────────────────────────────────────────

@pytest.mark.django_db
class TestTrackerSearchable:
    def test_spec_registered_with_entries_summary(self):
        spec = find_spec("tracker")
        assert spec is not None
        assert "entries_summary" in spec.search_fields
        assert spec.url_template == "/app/trackers/{id}"

    def test_related_returns_anchors(self, household, owner):
        project = Project.objects.create(household=household, title="Réno", created_by=owner)
        tracker = services.create_tracker(
            household, owner, name="Budget", project=project,
        )
        spec = find_spec("tracker")
        related = list(spec.related(tracker))
        assert related == [project]
