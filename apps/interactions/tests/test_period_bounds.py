"""Les bornes de période se lisent chez le foyer — et les deux écrans s'accordent.

Régression du parcours 26. « Ce mois-ci » avait deux définitions dans le module
Argent : le panneau Budgets bornait le mois sur le fuseau du foyer, le résumé des
dépenses le bornait en UTC. Pour un foyer à Paris, les deux premières heures du
1er et les deux dernières du 31 tombaient d'un côté ou de l'autre selon l'écran.

Ce n'est pas une imprécision d'affichage : c'est le mois qui décide de quel budget
relève un euro. Cliquer sur « 340 € / 400 € » pouvait donc ouvrir une page
annonçant 352 €, chacune juste selon sa propre borne — exactement le « deux voix
pour un même fait » que le parcours interdit.
"""
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from budget.aggregations import compute_budget_overview
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from zones.models import Zone

PARIS = ZoneInfo("Europe/Paris")


@pytest.fixture
def paris_household(db):
    """Un foyer à Paris — le décalage n'existe pas sous UTC, donc le test non plus."""
    household = Household.objects.create(name="Maison", timezone="Europe/Paris")
    user = UserFactory()
    HouseholdMember.objects.create(
        user=user, household=household, role=HouseholdMember.Role.OWNER
    )
    Zone.objects.create(household=household, name="Maison", created_by=user)
    return household, user


def _client(user, household) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    client.cookies["household_id"] = str(household.id)
    return client


def _expense(household, user, *, amount, occurred_at, budget=None):
    return Interaction.objects.create(
        household=household,
        created_by=user,
        subject="Dépense",
        type="expense",
        kind="manual",
        amount=Decimal(amount),
        budget=budget,
        occurred_at=occurred_at,
    )


@pytest.mark.django_db
class TestABareDateIsReadInTheHouseholdTimezone:
    def test_the_first_hours_of_the_month_belong_to_that_month(self, paris_household):
        """00 h 30 le 1er juillet à Paris, c'est 22 h 30 le 30 juin en UTC.

        Lue en UTC, la borne basse `from=2026-07-01` excluait cette dépense de
        juillet — et le panneau Budgets, lui, la comptait.
        """
        household, user = paris_household
        _expense(
            household,
            user,
            amount="40.00",
            occurred_at=datetime(2026, 7, 1, 0, 30, tzinfo=PARIS),
        )

        response = _client(user, household).get(
            reverse("interaction-expenses-summary"),
            {"from": "2026-07-01", "to": "2026-07-31"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "40.00"

    def test_the_last_hours_of_the_month_belong_to_that_month(self, paris_household):
        """23 h 30 le 31 juillet : la borne haute est une fin de journée locale."""
        household, user = paris_household
        _expense(
            household,
            user,
            amount="25.00",
            occurred_at=datetime(2026, 7, 31, 23, 30, tzinfo=PARIS),
        )

        response = _client(user, household).get(
            reverse("interaction-expenses-summary"),
            {"from": "2026-07-01", "to": "2026-07-31"},
        )

        assert response.data["total"] == "25.00"

    def test_the_previous_month_does_not_leak_in(self, paris_household):
        """Le miroir : 23 h 30 le 30 juin reste en juin."""
        household, user = paris_household
        _expense(
            household,
            user,
            amount="99.00",
            occurred_at=datetime(2026, 6, 30, 23, 30, tzinfo=PARIS),
        )

        response = _client(user, household).get(
            reverse("interaction-expenses-summary"),
            {"from": "2026-07-01", "to": "2026-07-31"},
        )

        assert response.data["total"] == "0.00"

    def test_the_list_agrees_with_the_summary(self, paris_household):
        """La liste et le total sont affichés côte à côte : ils comptent pareil.

        Les deux filtres étaient écrits séparément — l'un via `_parse_period`,
        l'autre en comparant la chaîne brute — ce qui laissait une page afficher
        un total qui ne correspondait pas aux lignes en dessous.
        """
        household, user = paris_household
        for moment in (
            datetime(2026, 7, 1, 0, 30, tzinfo=PARIS),
            datetime(2026, 7, 15, 12, 0, tzinfo=PARIS),
            datetime(2026, 7, 31, 23, 30, tzinfo=PARIS),
        ):
            _expense(household, user, amount="10.00", occurred_at=moment)

        client = _client(user, household)
        summary = client.get(
            reverse("interaction-expenses-summary"),
            {"from": "2026-07-01", "to": "2026-07-31"},
        )
        listing = client.get(
            reverse("interaction-list"),
            {"type": "expense", "start_date": "2026-07-01", "end_date": "2026-07-31"},
        )

        assert summary.data["count"] == 3
        assert summary.data["total"] == "30.00"
        assert listing.data["count"] == 3

    def test_an_explicit_instant_is_respected(self, paris_household):
        """Écrire une heure, c'est savoir ce qu'on demande — on n'y touche pas."""
        household, user = paris_household
        _expense(
            household,
            user,
            amount="12.00",
            occurred_at=datetime(2026, 7, 10, 18, 0, tzinfo=PARIS),
        )

        response = _client(user, household).get(
            reverse("interaction-expenses-summary"),
            {"from": "2026-07-10T00:00", "to": "2026-07-10T12:00"},
        )

        assert response.data["total"] == "0.00"


@pytest.mark.django_db
class TestTheTwoScreensAgree:
    """Le compteur du panneau Budgets et le total de la page qui l'ouvre.

    C'est *le* test de la régression : il compare les deux lectures nombre pour
    nombre, sur un mois dont les deux extrémités tombent dans la zone de
    décalage. Tant qu'ils passent par la même définition du mois, il tient.
    """

    def test_the_budget_counter_equals_the_expense_summary(
        self, paris_household, monkeypatch
    ):
        from budget.models import Budget
        from core import timezones as core_tz

        household, user = paris_household
        budget = Budget.objects.create(
            household=household,
            name="Courses",
            monthly_amount=Decimal("400.00"),
            created_by=user,
        )

        # Un instant fixe en plein juillet : sinon le test se met à dépendre du
        # jour où il tourne, et ne dit plus rien les 1ers et 31 du mois.
        fixed_now = datetime(2026, 7, 15, 10, 0, tzinfo=PARIS)
        monkeypatch.setattr(
            core_tz.timezone, "now", lambda: fixed_now.astimezone(ZoneInfo("UTC"))
        )

        for moment in (
            datetime(2026, 7, 1, 0, 30, tzinfo=PARIS),   # début de fenêtre décalée
            datetime(2026, 7, 20, 9, 0, tzinfo=PARIS),
            datetime(2026, 7, 31, 23, 30, tzinfo=PARIS),  # fin de fenêtre décalée
        ):
            _expense(household, user, amount="30.00", occurred_at=moment, budget=budget)

        overview = compute_budget_overview(household=household)
        row = next(b for b in overview["budgets"] if b["id"] == str(budget.id))

        response = _client(user, household).get(
            reverse("interaction-expenses-summary"),
            {"from": "2026-07-01", "to": "2026-07-31", "budget": str(budget.id)},
        )

        assert row["spent"] == "90.00"
        assert response.data["total"] == row["spent"]
