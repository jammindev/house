# recap/tests/test_api.py
"""
REST API tests for HouseholdRecapViewSet (/api/recap/).

Coverage:
  1. TestRecapList        — history, household scoping, cross-household isolation
  2. TestRecapLatest      — generates on first call, 204 when there is nothing to tell
  3. TestRecapRetrieve    — lookup by month, isolation
  4. TestRecapIsReadOnly  — a memory does not get edited
  5. TestRecapLanguage    — one snapshot, two languages
"""
from __future__ import annotations

from datetime import datetime
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
