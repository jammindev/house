"""Tests for GET /api/interactions/expenses/summary/."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from interactions.models import Interaction, InteractionZone
from zones.models import Zone


def _create_household(name: str) -> Household:
    return Household.objects.create(name=name)


def _add_membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _create_zone(household, user, name: str) -> Zone:
    return Zone.objects.create(household=household, name=name, created_by=user)


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _create_expense(household, user, zone, *, amount, occurred_at,
                    kind='manual', supplier='', subject='Expense'):
    interaction = Interaction.objects.create(
        household=household,
        created_by=user,
        subject=subject,
        type='expense',
        occurred_at=occurred_at,
        amount=amount,
        kind=kind,
        supplier=supplier,
    )
    if zone is not None:
        InteractionZone.objects.create(interaction=interaction, zone=zone)
    return interaction


@pytest.fixture
def owner(db):
    return UserFactory(email="expense-summary-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _create_household("Summary House")
    _add_membership(owner, instance, role=HouseholdMember.Role.OWNER)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.fixture
def zone(household, owner):
    return _create_zone(household, owner, "Kitchen")


@pytest.mark.django_db
class TestExpenseSummary:
    def url(self):
        return reverse("interaction-expenses-summary")

    def test_empty_household_returns_zeros(self, owner_client):
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "0.00"
        assert response.data["count"] == 0
        assert response.data["by_kind"] == []
        assert response.data["by_supplier"] == []
        assert response.data["by_month"] == []

    def test_single_expense_in_current_month(self, owner_client, household, owner, zone):
        _create_expense(
            household, owner, zone,
            amount=Decimal("42.50"), occurred_at=timezone.now(),
            kind="stock_purchase", supplier="Brico",
        )
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "42.50"
        assert response.data["count"] == 1
        assert response.data["by_kind"] == [
            {"kind": "stock_purchase", "total": "42.50", "count": 1},
        ]
        assert response.data["by_supplier"] == [
            {"supplier": "Brico", "total": "42.50", "count": 1},
        ]
        assert len(response.data["by_month"]) == 1

    def test_multiple_expenses_aggregate_correctly(self, owner_client, household, owner, zone):
        now = timezone.now()
        _create_expense(household, owner, zone, amount=Decimal("100.00"),
                        occurred_at=now, kind="stock_purchase", supplier="Brico")
        _create_expense(household, owner, zone, amount=Decimal("250.50"),
                        occurred_at=now, kind="equipment_purchase", supplier="Castorama")
        _create_expense(household, owner, zone, amount=Decimal("32.00"),
                        occurred_at=now, kind="manual", supplier="")

        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "382.50"
        assert response.data["count"] == 3
        kinds = {row["kind"]: row for row in response.data["by_kind"]}
        assert kinds["stock_purchase"]["total"] == "100.00"
        assert kinds["equipment_purchase"]["total"] == "250.50"
        assert kinds["manual"]["total"] == "32.00"

    def test_amount_null_is_skipped_in_total(self, owner_client, household, owner, zone):
        _create_expense(household, owner, zone, amount=Decimal("10.00"),
                        occurred_at=timezone.now(), kind="manual")
        _create_expense(household, owner, zone, amount=None,
                        occurred_at=timezone.now(), kind="manual")
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        # Two expenses, but only one has an amount: count=2, total=10.00
        assert response.data["total"] == "10.00"
        assert response.data["count"] == 2

    def test_filter_by_supplier(self, owner_client, household, owner, zone):
        now = timezone.now()
        _create_expense(household, owner, zone, amount=Decimal("100.00"),
                        occurred_at=now, kind="stock_purchase", supplier="Engie")
        _create_expense(household, owner, zone, amount=Decimal("200.00"),
                        occurred_at=now, kind="stock_purchase", supplier="Brico")
        response = owner_client.get(self.url() + "?supplier=Engie")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "100.00"
        assert response.data["count"] == 1

    def test_filter_by_kind(self, owner_client, household, owner, zone):
        now = timezone.now()
        _create_expense(household, owner, zone, amount=Decimal("100.00"),
                        occurred_at=now, kind="stock_purchase")
        _create_expense(household, owner, zone, amount=Decimal("200.00"),
                        occurred_at=now, kind="equipment_purchase")
        response = owner_client.get(self.url() + "?kind=equipment_purchase")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "200.00"
        assert response.data["count"] == 1

    def test_period_filter_excludes_outside_dates(self, owner_client, household, owner, zone):
        now = timezone.now()
        last_year = now - timedelta(days=400)
        _create_expense(household, owner, zone, amount=Decimal("999.00"),
                        occurred_at=last_year, kind="manual")
        _create_expense(household, owner, zone, amount=Decimal("10.00"),
                        occurred_at=now, kind="manual")

        from_param = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        to_param = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        response = owner_client.get(f"{self.url()}?from={from_param}&to={to_param}")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "10.00"
        assert response.data["count"] == 1

    def test_default_period_is_current_month(self, owner_client, household, owner, zone):
        now = timezone.now()
        last_month = (now.replace(day=1) - timedelta(days=1))
        _create_expense(household, owner, zone, amount=Decimal("500.00"),
                        occurred_at=last_month, kind="manual")
        _create_expense(household, owner, zone, amount=Decimal("75.00"),
                        occurred_at=now, kind="manual")
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "75.00"
        assert response.data["count"] == 1

    def test_scope_other_household_excluded(self, owner_client, household, owner, zone):
        other = _create_household("Other House")
        _add_membership(owner, other)
        other_zone = _create_zone(other, owner, "Other Kitchen")
        _create_expense(other, owner, other_zone, amount=Decimal("9999.99"),
                        occurred_at=timezone.now(), kind="manual")
        _create_expense(household, owner, zone, amount=Decimal("1.00"),
                        occurred_at=timezone.now(), kind="manual")
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        # Only expenses from selected household should be counted.
        assert response.data["total"] == "1.00"
        assert response.data["count"] == 1

    def test_editing_expense_amount_field_updates_aggregation(
        self, owner_client, household, owner, zone
    ):
        """Editing an expense via the promoted `amount`/`supplier` fields (the
        current front contract) updates the columns — and thus the summary."""
        exp = _create_expense(
            household, owner, zone,
            amount=Decimal("10.00"), occurred_at=timezone.now(), kind="manual",
        )
        resp = owner_client.patch(
            reverse("interaction-detail", kwargs={"pk": exp.id}),
            {"amount": "80.00", "supplier": "Brico"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        exp.refresh_from_db()
        assert exp.amount == Decimal("80.00")
        assert exp.supplier == "Brico"
        summary = owner_client.get(self.url())
        assert summary.data["total"] == "80.00"

    def test_non_expense_interactions_are_excluded(self, owner_client, household, owner, zone):
        Interaction.objects.create(
            household=household,
            created_by=owner,
            subject="Note",
            type="note",
            occurred_at=timezone.now(),
            metadata={"amount": "1000.00"},
        )
        _create_expense(household, owner, zone, amount=Decimal("12.00"),
                        occurred_at=timezone.now(), kind="manual")
        response = owner_client.get(self.url())
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total"] == "12.00"
        assert response.data["count"] == 1


@pytest.mark.django_db
class TestExpenseListFilters:
    """Verify the new metadata.kind / metadata.supplier filters on the list endpoint."""

    def test_list_filtered_by_kind(self, owner_client, household, owner, zone):
        _create_expense(household, owner, zone, amount=Decimal("10.00"),
                        occurred_at=timezone.now(), kind="stock_purchase",
                        subject="Stock buy")
        _create_expense(household, owner, zone, amount=Decimal("20.00"),
                        occurred_at=timezone.now(), kind="manual",
                        subject="Manual buy")
        response = owner_client.get(reverse("interaction-list") + "?type=expense&kind=manual")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["subject"] == "Manual buy"

    def test_list_filtered_by_supplier(self, owner_client, household, owner, zone):
        _create_expense(household, owner, zone, amount=Decimal("10.00"),
                        occurred_at=timezone.now(), kind="stock_purchase", supplier="Brico",
                        subject="With supplier")
        _create_expense(household, owner, zone, amount=Decimal("20.00"),
                        occurred_at=timezone.now(), kind="manual", supplier="",
                        subject="No supplier")
        response = owner_client.get(reverse("interaction-list") + "?type=expense&supplier=Brico")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["subject"] == "With supplier"


@pytest.mark.django_db
class TestFilteringByBudget:
    """« De quoi ce compteur est-il fait ? » — ouvrir un budget sur ses dépenses.

    Le panneau Budgets affiche « 340 € dépensés » ; sans ce filtre, la seule
    façon de voir *lesquelles* était de charger le journal entier et de le
    refiltrer dans le navigateur.
    """

    def _budget(self, household, name, amount=Decimal("400")):
        from budget.models import Budget

        return Budget.objects.create(household=household, name=name, monthly_amount=amount)

    def test_list_filtered_by_budget(self, owner_client, household, owner, zone):
        groceries = self._budget(household, "Courses")
        inside = _create_expense(household, owner, zone, amount=Decimal("30.00"),
                                 occurred_at=timezone.now(), subject="Dedans")
        inside.budget = groceries
        inside.save(update_fields=["budget"])
        _create_expense(household, owner, zone, amount=Decimal("20.00"),
                        occurred_at=timezone.now(), subject="Ailleurs")

        response = owner_client.get(
            reverse("interaction-list") + f"?type=expense&budget={groceries.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        assert [r["subject"] for r in response.data["results"]] == ["Dedans"]

    def test_budget_none_opens_the_unbudgeted_bucket(self, owner_client, household, owner, zone):
        """``none`` est une valeur, pas l'absence de filtre."""
        groceries = self._budget(household, "Courses")
        attached = _create_expense(household, owner, zone, amount=Decimal("30.00"),
                                   occurred_at=timezone.now(), subject="Rangée")
        attached.budget = groceries
        attached.save(update_fields=["budget"])
        _create_expense(household, owner, zone, amount=Decimal("20.00"),
                        occurred_at=timezone.now(), subject="Hors budget")

        response = owner_client.get(reverse("interaction-list") + "?type=expense&budget=none")

        assert [r["subject"] for r in response.data["results"]] == ["Hors budget"]

    def test_a_malformed_budget_id_lists_nothing_rather_than_everything(
        self, owner_client, household, owner, zone
    ):
        _create_expense(household, owner, zone, amount=Decimal("20.00"),
                        occurred_at=timezone.now(), subject="Une dépense")

        response = owner_client.get(reverse("interaction-list") + "?type=expense&budget=oops")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 0

    def test_summary_narrows_to_the_budget(self, owner_client, household, owner, zone):
        groceries = self._budget(household, "Courses")
        inside = _create_expense(household, owner, zone, amount=Decimal("30.00"),
                                 occurred_at=timezone.now(), supplier="Leclerc")
        inside.budget = groceries
        inside.save(update_fields=["budget"])
        _create_expense(household, owner, zone, amount=Decimal("70.00"),
                        occurred_at=timezone.now(), supplier="Fnac")

        response = owner_client.get(
            reverse("interaction-expenses-summary") + f"?budget={groceries.id}"
        )

        assert response.data["total"] == "30.00"
        assert response.data["count"] == 1
        assert [r["supplier"] for r in response.data["by_supplier"]] == ["Leclerc"]

    def test_summary_of_the_unbudgeted_bucket(self, owner_client, household, owner, zone):
        groceries = self._budget(household, "Courses")
        inside = _create_expense(household, owner, zone, amount=Decimal("30.00"),
                                 occurred_at=timezone.now())
        inside.budget = groceries
        inside.save(update_fields=["budget"])
        _create_expense(household, owner, zone, amount=Decimal("70.00"),
                        occurred_at=timezone.now())

        response = owner_client.get(reverse("interaction-expenses-summary") + "?budget=none")

        assert response.data["total"] == "70.00"

    def test_a_malformed_budget_id_on_the_summary_is_a_400_not_a_500(
        self, owner_client, household
    ):
        response = owner_client.get(reverse("interaction-expenses-summary") + "?budget=oops")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_another_households_budget_yields_nothing(self, owner_client, household, owner, zone):
        """Le filtre s'applique après le scope foyer — il ne peut pas l'élargir."""
        stranger_budget = self._budget(_create_household("Chez eux"), "Leur budget")
        _create_expense(household, owner, zone, amount=Decimal("20.00"),
                        occurred_at=timezone.now(), subject="La mienne")

        response = owner_client.get(
            reverse("interaction-list") + f"?type=expense&budget={stranger_budget.id}"
        )

        assert response.data["count"] == 0


@pytest.mark.django_db
class TestTheLastDayOfThePeriodCounts:
    """Régression : une date de fin nue veut dire « fin de cette journée ».

    Le filtre est un ``__lte`` ; lue à minuit, ``to=2026-07-31`` excluait toutes
    les dépenses du 31. Le dernier jour de chaque période disparaissait des
    totaux **et** de la liste, en silence — et le détail d'un budget ne tombait
    donc pas d'accord avec le compteur du panneau juste à côté.
    """

    def _late_expense(self, household, user, zone):
        from datetime import datetime, timezone as dt_tz

        return _create_expense(
            household, user, zone,
            amount=Decimal("42.00"),
            occurred_at=datetime(2026, 7, 31, 18, 30, tzinfo=dt_tz.utc),
            subject="Le 31 au soir",
        )

    def test_the_summary_includes_it(self, owner_client, household, owner, zone):
        self._late_expense(household, owner, zone)

        response = owner_client.get(
            reverse("interaction-expenses-summary") + "?from=2026-07-01&to=2026-07-31"
        )

        assert response.data["total"] == "42.00"

    def test_the_list_includes_it(self, owner_client, household, owner, zone):
        self._late_expense(household, owner, zone)

        response = owner_client.get(
            reverse("interaction-list")
            + "?type=expense&start_date=2026-07-01&end_date=2026-07-31"
        )

        assert [r["subject"] for r in response.data["results"]] == ["Le 31 au soir"]

    def test_an_explicit_instant_is_still_respected(self, owner_client, household, owner, zone):
        """Qui écrit une heure sait ce qu'il demande — on ne l'étend pas."""
        self._late_expense(household, owner, zone)

        response = owner_client.get(
            reverse("interaction-expenses-summary") + "?from=2026-07-01&to=2026-07-31T12:00:00Z"
        )

        assert response.data["total"] == "0.00"
