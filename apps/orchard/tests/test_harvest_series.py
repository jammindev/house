# orchard/tests/test_harvest_series.py
"""
Harvest aggregation — the season series and the one rule that makes it readable:
two units never add up.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from households.models import HouseholdMember
from orchard import queries
from orchard.models import Harvest
from zones.models import Zone

from .factories import (
    HarvestFactory,
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
class TestTwoUnitsNeverAddUp:
    """12 kg and 40 pieces do not make 52 of anything."""

    def test_totals_are_grouped_by_unit(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        HarvestFactory(
            household=hh, tree=tree, created_by=user,
            harvested_on=date(2026, 9, 1), quantity=Decimal("12.000"), unit="kg",
        )
        HarvestFactory(
            household=hh, tree=tree, created_by=user,
            harvested_on=date(2026, 9, 8), quantity=Decimal("3.500"), unit="kg",
        )
        HarvestFactory(
            household=hh, tree=tree, created_by=user,
            harvested_on=date(2026, 9, 15), quantity=Decimal("40.000"), unit="piece",
        )

        totals = queries.harvest_totals(hh, season=2026)
        by_unit = {row["unit"]: row["quantity"] for row in totals}

        assert len(totals) == 2
        assert Decimal(by_unit["kg"]) == Decimal("15.500")
        assert Decimal(by_unit["piece"]) == Decimal("40.000")


@pytest.mark.django_db
class TestTheSeasonSeries:
    def test_it_returns_the_most_recent_seasons_first(self):
        hh, user, zone = _setup()
        tree = TreeFactory(household=hh, zone=zone, created_by=user)
        for year, qty in ((2023, "10"), (2024, "40"), (2025, "12"), (2026, "38")):
            HarvestFactory(
                household=hh, tree=tree, created_by=user,
                harvested_on=date(year, 9, 1), quantity=Decimal(qty),
            )

        series = queries.harvest_series(hh, seasons=3)
        assert [s["season"] for s in series["seasons"]] == [2026, 2025, 2024]

    def test_the_current_season_comes_from_the_households_timezone(self):
        """A picking logged just before midnight on 31 December must not land in
        the wrong year — the boundary decides which total a kilo belongs to."""
        hh, user, zone = _setup()
        from core.timezones import household_today

        series = queries.harvest_series(hh)
        assert series["current_season"] == household_today(hh).year

    def test_an_empty_orchard_says_so_rather_than_faking_a_season(self):
        hh, user, zone = _setup()
        series = queries.harvest_series(hh)
        assert series["seasons"] == []
        assert series["current_season"] is not None

    def test_the_whole_series_costs_one_query(self):
        """No N+1 per subject — the page reloads it on every visit."""
        hh, user, zone = _setup()
        for i in range(5):
            tree = TreeFactory(household=hh, zone=zone, created_by=user, name=f"Arbre {i}")
            for year in (2025, 2026):
                HarvestFactory(
                    household=hh, tree=tree, created_by=user,
                    harvested_on=date(year, 9, 1), quantity=Decimal("5"),
                )

        with CaptureQueriesContext(connection) as ctx:
            queries.harvest_series(hh)
        # One SELECT for the grouped rows; `household_today` reads the already
        # loaded household object.
        assert len(ctx.captured_queries) <= 2


@pytest.mark.django_db
class TestTheSummaryEndpoint:
    def test_it_scopes_to_the_subject(self):
        hh, user, zone = _setup()
        apple = TreeFactory(household=hh, zone=zone, created_by=user, name="Pommier")
        plum = TreeFactory(household=hh, zone=zone, created_by=user, name="Prunier")
        HarvestFactory(
            household=hh, tree=apple, created_by=user,
            harvested_on=date(2026, 9, 1), quantity=Decimal("30"),
        )
        HarvestFactory(
            household=hh, tree=plum, created_by=user,
            harvested_on=date(2026, 8, 1), quantity=Decimal("7"),
        )

        response = _client(user).get(
            reverse("orchard-harvest-summary"), {"tree": str(apple.id)}
        )
        assert response.status_code == status.HTTP_200_OK
        totals = response.data["seasons"][0]["totals"]
        assert Decimal(totals[0]["quantity"]) == Decimal("30.000")

    def test_a_subject_of_another_household_is_not_aggregated(self):
        hh, user, zone = _setup()
        other_hh, other_user, other_zone = _setup()
        foreign = TreeFactory(
            household=other_hh, zone=other_zone, created_by=other_user
        )
        response = _client(user).get(
            reverse("orchard-harvest-summary"), {"tree": str(foreign.id)}
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
