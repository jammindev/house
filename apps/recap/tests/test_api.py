# recap/tests/test_api.py
"""
REST API tests for HouseholdRecapViewSet (/api/recap/).

Coverage:
  1. TestRecapList        — history, household scoping, cross-household isolation
  2. TestRecapLatest      — generates on first call, 204 when there is nothing to tell
  3. TestRecapRetrieve    — lookup by month, isolation
  4. TestRecapIsReadOnly  — a memory does not get edited
  5. TestRecapLanguage    — one snapshot, two languages
  6. TestAMonthDoesNotFreezeBeforeItCloses — the grace period is what it is for
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from interactions.services import create_manual_expense_interaction
from recap.models import HouseholdRecap
from recap.service import get_or_generate_recap, last_closed_month

from .factories import HouseholdFactory, make_owner


@pytest.fixture
def on_day(monkeypatch):
    """Pin the household-local clock to a calendar day (test households are UTC)."""
    from core import timezones

    def _pin(day: date):
        monkeypatch.setattr(
            timezones.timezone,
            "now",
            lambda: datetime(day.year, day.month, day.day, 12, tzinfo=ZoneInfo("UTC")),
        )

    return _pin


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_expense(household, user, amount, *, month, subject="Test expense"):
    tz = ZoneInfo(getattr(household, "timezone", None) or "UTC")
    year, mon = (int(p) for p in month.split("-"))
    return create_manual_expense_interaction(
        household=household,
        user=user,
        subject=subject,
        amount=Decimal(str(amount)),
        occurred_at=datetime(year, mon, 15, tzinfo=tz),
    )


def _fill_last_closed_month(household, user):
    """Give the last closed month enough to clear ``RECAP_MIN_CARDS`` (3 cards).

    Two expenses give ``total_spent`` + ``biggest_expense``; a budget is what makes
    ``budget_outcome`` tellable, hence the third card.
    """
    from budget.services import create_budget

    month = last_closed_month(household)
    _make_expense(household, user, "120.00", month=month, subject="Plumber")
    _make_expense(household, user, "40.00", month=month, subject="Cinema")
    create_budget(household, user, name="Courses", monthly_amount=Decimal("400"))
    return month


def _results(response):
    data = response.json()
    return data["results"] if isinstance(data, dict) and "results" in data else data


# ===========================================================================
# 1. TestRecapList
# ===========================================================================


@pytest.mark.django_db
class TestRecapList:
    def test_anonymous_is_refused(self):
        response = APIClient().get("/api/recap/")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_a_member_sees_the_history_of_their_household(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-05")
        get_or_generate_recap(hh, "2026-05")
        get_or_generate_recap(hh, "2026-04")

        response = _client_for(owner).get("/api/recap/")

        assert response.status_code == status.HTTP_200_OK
        months = [row["month"] for row in _results(response)]
        assert months == ["2026-05", "2026-04"]  # newest first

    def test_another_household_recap_is_invisible(self):
        mine, theirs = HouseholdFactory(), HouseholdFactory()
        owner = make_owner(mine)
        other_owner = make_owner(theirs)
        _make_expense(theirs, other_owner, "999.00", month="2026-05")
        get_or_generate_recap(theirs, "2026-05")

        response = _client_for(owner).get("/api/recap/")

        assert _results(response) == []

    def test_the_raw_snapshot_is_never_exposed(self):
        """``stats`` is an internal format — publishing it would make every client a
        second renderer, and the ``_polished`` cache is nobody's business."""
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-05")
        get_or_generate_recap(hh, "2026-05")

        row = _results(_client_for(owner).get("/api/recap/"))[0]

        assert "stats" not in row
        assert set(row) == {"id", "month", "card_count", "chapters", "created_at"}


# ===========================================================================
# 2. TestRecapLatest
# ===========================================================================


@pytest.mark.django_db
class TestRecapLatest:
    def test_it_generates_the_snapshot_on_the_first_call(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        month = _fill_last_closed_month(hh, owner)
        assert not HouseholdRecap.objects.filter(household=hh).exists()

        response = _client_for(owner).get("/api/recap/latest/")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["month"] == month
        assert HouseholdRecap.objects.filter(household=hh, month=month).exists()

    def test_a_second_call_reads_the_same_snapshot(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill_last_closed_month(hh, owner)
        client = _client_for(owner)

        first = client.get("/api/recap/latest/").json()
        second = client.get("/api/recap/latest/").json()

        assert first["id"] == second["id"]
        assert HouseholdRecap.objects.filter(household=hh).count() == 1

    def test_a_month_with_too_little_to_tell_answers_204(self):
        """« Rien à raconter » is a legitimate answer, not an error — and the snapshot
        still exists, browsable from the history."""
        hh = HouseholdFactory()
        owner = make_owner(hh)

        response = _client_for(owner).get("/api/recap/latest/")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert HouseholdRecap.objects.filter(household=hh).exists()

    def test_the_threshold_is_configurable(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill_last_closed_month(hh, owner)

        with override_settings(RECAP_MIN_CARDS=99):
            response = _client_for(owner).get("/api/recap/latest/")

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_the_payload_carries_rendered_cards(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _fill_last_closed_month(hh, owner)

        data = _client_for(owner).get("/api/recap/latest/").json()

        card = data["chapters"][0]["cards"][0]
        assert set(card) >= {"kind", "emoji", "headline", "value", "value_type", "caption"}
        assert data["card_count"] >= 3


# ===========================================================================
# 3. TestRecapRetrieve
# ===========================================================================


@pytest.mark.django_db
class TestRecapRetrieve:
    def test_a_recap_is_fetched_by_its_month(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-05")
        get_or_generate_recap(hh, "2026-05")

        response = _client_for(owner).get("/api/recap/2026-05/")

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["month"] == "2026-05"

    def test_a_month_never_frozen_is_a_404(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)

        response = _client_for(owner).get("/api/recap/2019-01/")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_another_household_month_is_a_404_not_a_leak(self):
        mine, theirs = HouseholdFactory(), HouseholdFactory()
        owner = make_owner(mine)
        other_owner = make_owner(theirs)
        _make_expense(theirs, other_owner, "999.00", month="2026-05")
        get_or_generate_recap(theirs, "2026-05")

        response = _client_for(owner).get("/api/recap/2026-05/")

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 4. TestRecapIsReadOnly
# ===========================================================================


@pytest.mark.django_db
class TestRecapIsReadOnly:
    @pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
    def test_writes_are_refused(self, method):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        _make_expense(hh, owner, "100.00", month="2026-05")
        get_or_generate_recap(hh, "2026-05")
        client = _client_for(owner)

        url = "/api/recap/" if method == "post" else "/api/recap/2026-05/"
        response = getattr(client, method)(url, {}, format="json")

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


# ===========================================================================
# 5. TestRecapLanguage
# ===========================================================================


@pytest.mark.django_db
class TestRecapLanguage:
    def test_two_languages_read_one_snapshot(self):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        month = _fill_last_closed_month(hh, owner)
        client = _client_for(owner)

        en = client.get("/api/recap/latest/", headers={"accept-language": "en"}).json()
        fr = client.get("/api/recap/latest/", headers={"accept-language": "fr"}).json()

        assert en["id"] == fr["id"]
        assert HouseholdRecap.objects.filter(household=hh, month=month).count() == 1


# ===========================================================================
# 6. TestAMonthDoesNotFreezeBeforeItCloses
# ===========================================================================


@pytest.mark.django_db
class TestAMonthDoesNotFreezeBeforeItCloses:
    """A snapshot is frozen once and never recomputed — so *when* it freezes is the
    whole question. Freezing on the 1st locks the month before the household has
    finished recording it: the ticket entered on the 3rd never makes the recap.

    July 2026 closes on Friday 7 August (5th business day: Sat 1 and Sun 2 are not
    business days, so Mon 3 is the first).
    """

    def _fill(self, household, user, month, *, budget=True):
        """Two expenses (+ the household's one budget) = three cards, over the bar."""
        from budget.services import create_budget

        _make_expense(household, user, "120.00", month=month, subject="Plumber")
        _make_expense(household, user, "40.00", month=month, subject="Cinema")
        if budget:
            create_budget(household, user, name="Courses", monthly_amount=Decimal("400"))

    def test_opening_the_dashboard_on_the_first_freezes_nothing(self, on_day):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        self._fill(hh, owner, "2026-07")
        on_day(date(2026, 8, 1))

        _client_for(owner).get("/api/recap/latest/")

        assert not HouseholdRecap.objects.filter(household=hh, month="2026-07").exists()

    def test_an_expense_recorded_during_the_grace_period_still_counts(self, on_day):
        hh = HouseholdFactory()
        owner = make_owner(hh)
        self._fill(hh, owner, "2026-07")

        on_day(date(2026, 8, 1))
        _client_for(owner).get("/api/recap/latest/")  # someone opens the dashboard
        _make_expense(hh, owner, "860.00", month="2026-07", subject="Roof")

        on_day(date(2026, 8, 7))
        response = _client_for(owner).get("/api/recap/latest/")

        assert response.json()["month"] == "2026-07"
        recap = HouseholdRecap.objects.get(household=hh, month="2026-07")
        assert "1020.00" in str(recap.stats)  # 120 + 40 + 860, the late one included

    def test_the_closing_day_is_what_latest_answers(self, on_day):
        """Before it, ``latest`` is still the month before — a recap the household
        has already read, not a half-frozen one."""
        hh = HouseholdFactory()
        owner = make_owner(hh)
        self._fill(hh, owner, "2026-06")
        self._fill(hh, owner, "2026-07", budget=False)

        on_day(date(2026, 8, 6))
        before = _client_for(owner).get("/api/recap/latest/").json()
        on_day(date(2026, 8, 7))
        after = _client_for(owner).get("/api/recap/latest/").json()

        assert before["month"] == "2026-06"
        assert after["month"] == "2026-07"
