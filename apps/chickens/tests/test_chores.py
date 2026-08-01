"""
Recurring coop chores — cadence, due date, reminder and dashboard alert.

What these tests pin down, in order of how much it would cost to lose it:

1. **The due date is derived, never stored.** Deleting or backdating the journal
   entry moves the due date back with it. This is the whole reason the model has
   no ``last_done_on`` column.
2. **One verdict, read by everyone.** The panel (serializer), the reminder ping
   and the dashboard alert must agree on what is late — the codebase has already
   paid for two screens disagreeing about the same number.
3. **REST and agent produce the same thing**, because both go through
   ``chickens.services`` and nothing else.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from chickens.models import ChickenChore, ChickenEvent
from chickens.services import (
    chores_with_status,
    complete_chore,
    create_chore,
    overdue_chores,
)
from households.models import HouseholdMember

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory


def _make_owner(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def household(db):
    return HouseholdFactory()


@pytest.fixture
def owner(household):
    return _make_owner(household)


@pytest.fixture
def client(owner):
    return _client_for(owner)


@pytest.mark.django_db
class TestTheCadenceIsCountedFromTheLastTimeItWasDone:

    def test_a_chore_never_done_is_due_an_interval_after_its_start(self, household, owner):
        chore = create_chore(
            household, owner, name="Nettoyer le poulailler", interval_days=7,
            starts_on=date(2026, 1, 1),
        )

        (_chore, state), = chores_with_status(household, today=date(2026, 1, 5))

        assert state["never_done"] is True
        assert state["next_due_on"] == date(2026, 1, 8)
        assert state["is_due"] is False
        assert chore.pk is not None

    def test_doing_it_pushes_the_due_date_by_one_interval(self, household, owner):
        chore = create_chore(
            household, owner, name="Laver le mangeoir", interval_days=14,
            starts_on=date(2026, 1, 1),
        )

        complete_chore(household, owner, chore, occurred_on=date(2026, 1, 20))

        (_chore, state), = chores_with_status(household, today=date(2026, 1, 21))
        assert state["last_done_on"] == date(2026, 1, 20)
        assert state["next_due_on"] == date(2026, 2, 3)
        assert state["is_due"] is False

    def test_due_today_is_due_but_not_late(self, household, owner):
        chore = create_chore(
            household, owner, name="Changer la litière", interval_days=10,
            starts_on=date(2026, 1, 1),
        )
        complete_chore(household, owner, chore, occurred_on=date(2026, 1, 1))

        (_chore, state), = chores_with_status(household, today=date(2026, 1, 11))

        assert state["is_due"] is True
        assert state["days_overdue"] == 0

    def test_a_chore_left_undone_accumulates_lateness(self, household, owner):
        chore = create_chore(
            household, owner, name="Vermifuger", interval_days=30,
            starts_on=date(2026, 1, 1),
        )
        complete_chore(household, owner, chore, occurred_on=date(2026, 1, 1))

        (_chore, state), = chores_with_status(household, today=date(2026, 2, 5))

        assert state["days_overdue"] == 5
        assert state["is_due"] is True

    def test_only_the_latest_completion_counts(self, household, owner):
        """Backfilling an older entry must not drag the due date backwards."""
        chore = create_chore(
            household, owner, name="Nettoyer", interval_days=7, starts_on=date(2026, 1, 1),
        )
        complete_chore(household, owner, chore, occurred_on=date(2026, 1, 20))
        complete_chore(household, owner, chore, occurred_on=date(2026, 1, 5))

        (_chore, state), = chores_with_status(household, today=date(2026, 1, 21))

        assert state["last_done_on"] == date(2026, 1, 20)


@pytest.mark.django_db
class TestTheDueDateIsDerivedAndNeverStored:
    """The reason ChickenChore has no ``last_done_on`` column.

    A stored due date drifts the first time a journal entry is corrected, and a
    reminder firing on a stale date is worse than no reminder at all.
    """

    def test_the_model_has_no_last_done_column(self):
        columns = {field.name for field in ChickenChore._meta.get_fields()}
        assert "last_done_on" not in columns
        assert "next_due_on" not in columns

    def test_deleting_the_journal_entry_rolls_the_due_date_back(self, household, owner):
        chore = create_chore(
            household, owner, name="Nettoyer", interval_days=7, starts_on=date(2026, 1, 1),
        )
        event = complete_chore(household, owner, chore, occurred_on=date(2026, 1, 20))
        assert chores_with_status(household, today=date(2026, 1, 21))[0][1]["is_due"] is False

        event.delete()

        (_chore, state), = chores_with_status(household, today=date(2026, 1, 21))
        assert state["never_done"] is True
        assert state["next_due_on"] == date(2026, 1, 8)
        assert state["is_due"] is True

    def test_correcting_the_entrys_date_moves_the_due_date_with_it(self, household, owner):
        chore = create_chore(
            household, owner, name="Nettoyer", interval_days=7, starts_on=date(2026, 1, 1),
        )
        event = complete_chore(household, owner, chore, occurred_on=date(2026, 1, 20))

        event.occurred_on = date(2026, 1, 10)
        event.save(update_fields=["occurred_on"])

        (_chore, state), = chores_with_status(household, today=date(2026, 1, 21))
        assert state["next_due_on"] == date(2026, 1, 17)
        assert state["days_overdue"] == 4


@pytest.mark.django_db
class TestDoingAChoreWritesTheFlockJournal:

    def test_completion_is_a_care_entry_linked_to_the_chore(self, household, owner):
        chore = create_chore(
            household, owner, name="Nettoyer le poulailler", emoji="🧹",
            interval_days=7, starts_on=date(2026, 1, 1),
        )

        event = complete_chore(household, owner, chore, occurred_on=date(2026, 1, 8))

        assert event.type == ChickenEvent.Type.CARE
        assert event.chore_id == chore.id
        assert event.title == "🧹 Nettoyer le poulailler"
        assert event.household_id == household.id

    def test_deleting_the_chore_keeps_its_history(self, household, owner):
        """SET_NULL, not CASCADE: dropping a cadence must not erase the proof."""
        chore = create_chore(
            household, owner, name="Vermifuger", interval_days=90, starts_on=date(2026, 1, 1),
        )
        event = complete_chore(household, owner, chore, occurred_on=date(2026, 1, 5))

        chore.delete()

        event.refresh_from_db()
        assert event.chore_id is None
        assert event.title == "Vermifuger"

    def test_a_chore_of_another_household_is_refused(self, household, owner):
        other = HouseholdFactory()
        other_owner = _make_owner(other)
        foreign = create_chore(
            other, other_owner, name="Chez le voisin", interval_days=7,
        )

        with pytest.raises(ValueError):
            complete_chore(household, owner, foreign)


@pytest.mark.django_db
class TestPausingTakesAChoreOutOfTheCadence:

    def test_a_paused_chore_is_not_reported_late(self, household, owner):
        chore = create_chore(
            household, owner, name="Nettoyer", interval_days=7, starts_on=date(2026, 1, 1),
        )
        assert overdue_chores(household, today=date(2026, 2, 1))

        chore.is_active = False
        chore.save(update_fields=["is_active"])

        assert overdue_chores(household, today=date(2026, 2, 1)) == []


@pytest.mark.django_db
class TestTheApi:

    def test_crud_and_the_derived_status_travel_together(self, client, household):
        response = client.post(
            "/api/chickens/chores/",
            {"name": "Nettoyer le poulailler", "interval_days": 7, "emoji": "🧹"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["status"]["never_done"] is True
        assert body["status"]["next_due_on"]

        chore_id = body["id"]
        listed = client.get("/api/chickens/chores/").json()
        rows = listed["results"] if isinstance(listed, dict) else listed
        assert [row["id"] for row in rows] == [chore_id]

    def test_completing_returns_the_refreshed_status(self, client, household, owner):
        chore = create_chore(
            household, owner, name="Nettoyer", interval_days=7, starts_on=date(2026, 1, 1),
        )

        response = client.post(f"/api/chickens/chores/{chore.id}/complete/", {}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["event"]["type"] == "care"
        assert body["chore"]["status"]["never_done"] is False
        # The point of re-reading server-side: the caller's due date just moved.
        assert body["chore"]["status"]["last_done_on"] is not None

    def test_an_interval_below_one_day_is_refused(self, client):
        response = client.post(
            "/api/chickens/chores/", {"name": "Impossible", "interval_days": 0}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_paused_chore_is_hidden_unless_asked_for(self, client, household, owner):
        create_chore(household, owner, name="Active", interval_days=7)
        paused = create_chore(household, owner, name="Paused", interval_days=7)
        paused.is_active = False
        paused.save(update_fields=["is_active"])

        default = client.get("/api/chickens/chores/").json()
        default_rows = default["results"] if isinstance(default, dict) else default
        assert [row["name"] for row in default_rows] == ["Active"]

        everything = client.get("/api/chickens/chores/?active=false").json()
        all_rows = everything["results"] if isinstance(everything, dict) else everything
        assert {row["name"] for row in all_rows} == {"Active", "Paused"}

    def test_another_households_chore_is_invisible(self, client):
        other = HouseholdFactory()
        other_owner = _make_owner(other)
        foreign = create_chore(other, other_owner, name="Chez le voisin", interval_days=7)

        listed = client.get("/api/chickens/chores/").json()
        rows = listed["results"] if isinstance(listed, dict) else listed
        assert str(foreign.id) not in [row["id"] for row in rows]

        assert client.get(f"/api/chickens/chores/{foreign.id}/").status_code == (
            status.HTTP_404_NOT_FOUND
        )

    def test_listing_chores_costs_the_same_whatever_the_number_of_chores(
        self, client, household, owner, django_capture_on_commit_callbacks
    ):
        """The invariant is flatness, not a magic number.

        Two things could break it: the last completion read per row instead of
        annotated, and the household loaded per row to know what day it is. Both
        were there at first, and neither shows on a household with one chore.
        """
        from django.test.utils import CaptureQueriesContext
        from django.db import connection

        def count_queries():
            with CaptureQueriesContext(connection) as ctx:
                client.get("/api/chickens/chores/")
            return len(ctx.captured_queries)

        for i in range(2):
            chore = create_chore(household, owner, name=f"Corvée {i}", interval_days=7)
            complete_chore(household, owner, chore)
        with_two = count_queries()

        for i in range(2, 8):
            chore = create_chore(household, owner, name=f"Corvée {i}", interval_days=7)
            complete_chore(household, owner, chore)
        with_eight = count_queries()

        assert with_eight == with_two


@pytest.mark.django_db
class TestTheRestApiAndTheAgentAgree:
    """The non-duplication lock: both paths go through ``chickens.services``."""

    def test_the_agent_creates_exactly_what_the_api_creates(self, client, household, owner):
        from chickens.apps import _create_chore_from_agent

        api_body = client.post(
            "/api/chickens/chores/",
            {"name": "Par l'API", "interval_days": 14, "emoji": "🧹", "notes": "note"},
            format="json",
        ).json()

        by_agent = _create_chore_from_agent(
            household,
            owner,
            {"name": "Par l'agent", "interval_days": 14, "emoji": "🧹", "notes": "note"},
        )

        assert by_agent.interval_days == api_body["interval_days"]
        assert by_agent.emoji == api_body["emoji"]
        assert by_agent.notes == api_body["notes"]
        assert by_agent.starts_on.isoformat() == api_body["starts_on"]
        assert by_agent.is_active is api_body["is_active"]

    def test_the_agent_marks_a_chore_done_by_name(self, household, owner):
        from chickens.apps import _complete_chore_from_agent

        chore = create_chore(household, owner, name="Nettoyer le poulailler", interval_days=7)

        event = _complete_chore_from_agent(
            household, owner, {"chore": "nettoyer le poulailler"}
        )

        assert event.chore_id == chore.id
        assert event.type == ChickenEvent.Type.CARE

    def test_an_ambiguous_name_is_refused_rather_than_guessed(self, household, owner):
        from chickens.apps import _complete_chore_from_agent

        create_chore(household, owner, name="Nettoyage du poulailler", interval_days=7)
        create_chore(household, owner, name="Nettoyage du mangeoir", interval_days=7)

        with pytest.raises(ValueError, match="several"):
            _complete_chore_from_agent(household, owner, {"chore": "nettoyage"})

    def test_undoing_a_done_removes_the_entry_and_the_due_date_rolls_back(
        self, household, owner
    ):
        from chickens.apps import _complete_chore_from_agent, _delete_completion_from_agent

        chore = create_chore(
            household, owner, name="Nettoyer", interval_days=7, starts_on=date(2026, 1, 1),
        )
        event = _complete_chore_from_agent(
            household, owner, {"chore": "Nettoyer", "occurred_on": date(2026, 1, 20)}
        )

        _delete_completion_from_agent(household, owner, str(event.id))

        (_chore, state), = chores_with_status(household, today=date(2026, 1, 21))
        assert state["never_done"] is True

    def test_the_agent_cannot_reach_another_households_chore(self, household, owner):
        from chickens.apps import _complete_chore_from_agent

        other = HouseholdFactory()
        other_owner = _make_owner(other)
        create_chore(other, other_owner, name="Chez le voisin", interval_days=7)

        with pytest.raises(ValueError, match="no coop chore"):
            _complete_chore_from_agent(household, owner, {"chore": "Chez le voisin"})


@pytest.mark.django_db
class TestTheReminderAndTheDashboardAgreeWithThePanel:
    """One verdict on "late", read by three screens.

    A panel showing a chore as fine while the notification calls it late makes
    both untrustworthy — the same failure the money module already fixed once.
    """

    def test_the_dashboard_alert_lists_what_overdue_chores_lists(self, household, owner):
        from alerts.services import build_alerts_summary

        late = create_chore(
            household, owner, name="En retard", interval_days=7, starts_on=date(2026, 1, 1),
        )
        fresh = create_chore(household, owner, name="À jour", interval_days=7)
        complete_chore(household, owner, fresh)

        today = date(2026, 2, 1)
        summary = build_alerts_summary(household, today=today)
        from_service = {chore.id for chore, _state in overdue_chores(household, today=today)}

        assert {row["id"] for row in summary["due_chores"]} == {str(pk) for pk in from_service}
        assert str(late.id) in {row["id"] for row in summary["due_chores"]}
        assert summary["total"] >= len(summary["due_chores"])

    def test_the_serializer_says_late_exactly_when_the_service_does(self, client, household, owner):
        create_chore(
            household, owner, name="En retard", interval_days=7, starts_on=date(2026, 1, 1),
        )
        fresh = create_chore(household, owner, name="À jour", interval_days=30)
        complete_chore(household, owner, fresh)

        listed = client.get("/api/chickens/chores/").json()
        rows = listed["results"] if isinstance(listed, dict) else listed
        served = {row["name"]: row["status"]["is_due"] for row in rows}

        from chickens.services import chores_with_status

        computed = {
            chore.name: state["is_due"] for chore, state in chores_with_status(household)
        }
        assert served == computed

    def test_the_ping_names_every_late_chore_and_nothing_else(self, household, owner):
        from chickens.pings import build_chore_ping

        create_chore(
            household, owner, name="En retard", interval_days=7, starts_on=date(2026, 1, 1),
        )
        fresh = create_chore(household, owner, name="À jour", interval_days=365)
        complete_chore(household, owner, fresh, occurred_on=date(2026, 1, 30))

        message = build_chore_ping(household, owner, today=date(2026, 2, 1))

        assert message is not None
        assert "En retard" in message
        assert "À jour" not in message

    def test_no_late_chore_means_no_ping_at_all(self, household, owner):
        from chickens.pings import build_chore_ping

        chore = create_chore(household, owner, name="À jour", interval_days=30)
        complete_chore(household, owner, chore, occurred_on=date(2026, 1, 30))

        assert build_chore_ping(household, owner, today=date(2026, 2, 1)) is None

    def test_the_ping_drops_one_notification_for_the_whole_coop(self, household, owner):
        """Four late chores must not become four notifications the same evening."""
        from chickens.pings import build_chore_ping
        from notifications.models import Notification

        for i in range(4):
            create_chore(
                household, owner, name=f"Corvée {i}", interval_days=7,
                starts_on=date(2026, 1, 1),
            )

        build_chore_ping(household, owner, today=date(2026, 2, 1))
        build_chore_ping(household, owner, today=date(2026, 2, 1))

        notifs = Notification.objects.filter(
            user=owner, type=Notification.Type.CHICKEN_CHORE_DUE, deleted_at__isnull=True
        )
        assert notifs.count() == 1
        assert notifs.first().url == "/app/chickens"

    def test_the_alert_is_silent_when_the_module_is_disabled(self, household, owner):
        from alerts.services import build_alerts_summary

        create_chore(
            household, owner, name="En retard", interval_days=7, starts_on=date(2026, 1, 1),
        )
        household.disabled_modules = ["chickens"]
        household.save(update_fields=["disabled_modules"])

        summary = build_alerts_summary(household, today=date(2026, 2, 1))

        assert summary["due_chores"] == []


@pytest.mark.django_db
class TestTheReminderTypeCanBeSilenced:

    def test_the_chore_reminder_is_mutable(self):
        from notifications.models import MUTABLE_TYPES, Notification

        assert Notification.Type.CHICKEN_CHORE_DUE in MUTABLE_TYPES

    def test_a_user_who_muted_it_gets_nothing(self, household, owner):
        from chickens.pings import build_chore_ping
        from notifications.models import Notification

        owner.muted_notification_types = [Notification.Type.CHICKEN_CHORE_DUE]
        owner.save(update_fields=["muted_notification_types"])
        create_chore(
            household, owner, name="En retard", interval_days=7, starts_on=date(2026, 1, 1),
        )

        message = build_chore_ping(household, owner, today=date(2026, 2, 1))

        # The Telegram text still goes out (that channel has its own opt-in);
        # the bell stays silent, which is what muting means.
        assert message is not None
        assert not Notification.objects.filter(
            user=owner, type=Notification.Type.CHICKEN_CHORE_DUE
        ).exists()
