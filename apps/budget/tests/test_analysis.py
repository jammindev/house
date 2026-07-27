# budget/tests/test_analysis.py
"""L'analyse longue des dépenses par budget.

Le panneau Budgets ne répond qu'à « ce mois-ci tient-il dans l'enveloppe ». Une
catégorie qui dérive lentement, ou une catégorie **sans plafond** — le cas
courant depuis que le plafond est optionnel — n'y produisent aucun signal. Ces
tests fixent ce que la lecture longue doit dire, et surtout ce qu'elle ne doit
jamais inventer : une part sur un total nul, une moyenne qui écarte les mois
vides, un budget mort dans la légende.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from rest_framework import status
from rest_framework.test import APIClient
from django.urls import reverse

from budget.analysis import compute_budget_analysis
from budget.models import Budget
from households.models import HouseholdMember
from interactions.services import create_manual_expense_interaction

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory

TODAY = date(2026, 7, 15)
TZ = ZoneInfo("Europe/Paris")


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


def _spend(household, user, amount, *, month, budget=None, supplier="", day=10):
    year, mon = (int(p) for p in month.split("-"))
    return create_manual_expense_interaction(
        household=household,
        user=user,
        subject=f"{supplier or 'Dépense'} {amount}",
        amount=Decimal(str(amount)),
        supplier=supplier,
        occurred_at=datetime(year, mon, day, 12, 0, tzinfo=TZ),
        budget_id=budget.id if budget else None,
    )


@pytest.fixture
def ctx(db):
    household = HouseholdFactory(timezone="Europe/Paris")
    owner = _make_owner(household)
    groceries = Budget.objects.create(
        household=household, name="Courses", monthly_amount=Decimal("400")
    )
    gifts = Budget.objects.create(household=household, name="Cadeaux", monthly_amount=None)
    return household, owner, groceries, gifts


@pytest.mark.django_db
class TestTheMonthlySeries:
    def test_one_row_per_budget_that_actually_spent(self, ctx):
        """Un budget sans une seule dépense n'encombre pas la légende."""
        household, owner, groceries, gifts = ctx
        Budget.objects.create(household=household, name="Jamais servi", monthly_amount=None)
        _spend(household, owner, "120.00", month="2026-07", budget=groceries)

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert [s["name"] for s in result["series"]] == ["Courses"]

    def test_values_align_with_the_month_labels(self, ctx):
        household, owner, groceries, _ = ctx
        _spend(household, owner, "100.00", month="2026-05", budget=groceries)
        _spend(household, owner, "250.00", month="2026-07", budget=groceries)

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert result["months"][-1] == "2026-07"
        assert result["months"][0] == "2025-08"
        assert len(result["months"]) == 12
        row = result["series"][0]
        assert len(row["values"]) == 12
        by_month = dict(zip(result["months"], row["values"]))
        assert by_month["2026-05"] == "100.00"
        assert by_month["2026-06"] == "0.00"
        assert by_month["2026-07"] == "250.00"

    def test_unbudgeted_is_a_row_with_no_name_and_closes_the_march(self, ctx):
        """Le libellé « hors budget » vit dans l'i18n du front, pas ici."""
        household, owner, groceries, _ = ctx
        _spend(household, owner, "50.00", month="2026-07", budget=groceries)
        _spend(household, owner, "30.00", month="2026-07")

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert [s["name"] for s in result["series"]] == ["Courses", None]
        assert result["series"][-1]["budget_id"] is None

    def test_an_uncapped_category_carries_a_null_ceiling(self, ctx):
        household, owner, _, gifts = ctx
        _spend(household, owner, "80.00", month="2026-07", budget=gifts)

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert result["series"][0]["monthly_amount"] is None

    def test_expenses_older_than_the_window_are_excluded(self, ctx):
        household, owner, groceries, _ = ctx
        _spend(household, owner, "999.00", month="2025-01", budget=groceries)
        _spend(household, owner, "10.00", month="2026-07", budget=groceries)

        result = compute_budget_analysis(household=household, months=6, today=TODAY)

        assert result["total"] == "10.00"
        assert len(result["months"]) == 6


@pytest.mark.django_db
class TestTheTotalsItRefusesToInvent:
    def test_no_spending_gives_no_shares_rather_than_zeroes(self, ctx):
        """Une part sur un total nul est une division par zéro déguisée."""
        household, _, _, _ = ctx

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert result["total"] == "0.00"
        assert result["breakdown"] == []
        assert result["monthly_average"] == "0.00"

    def test_the_average_counts_the_empty_months_too(self, ctx):
        """Écarter les mois vides gonflerait la moyenne d'un facteur arbitraire."""
        household, owner, groceries, _ = ctx
        _spend(household, owner, "120.00", month="2026-07", budget=groceries)

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert result["total"] == "120.00"
        assert result["monthly_average"] == "10.00"

    def test_shares_are_computed_on_the_window_total(self, ctx):
        household, owner, groceries, gifts = ctx
        _spend(household, owner, "300.00", month="2026-07", budget=groceries)
        _spend(household, owner, "100.00", month="2026-06", budget=gifts)

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        shares = {row["name"]: row["share"] for row in result["breakdown"]}
        assert shares == {"Courses": 0.75, "Cadeaux": 0.25}
        # Trié du plus gros au plus petit — un classement se lit dans cet ordre.
        assert [row["name"] for row in result["breakdown"]] == ["Courses", "Cadeaux"]


@pytest.mark.django_db
class TestSuppliersAndBiggest:
    def test_suppliers_are_ranked_by_amount_not_by_count(self, ctx):
        household, owner, groceries, _ = ctx
        _spend(household, owner, "10.00", month="2026-07", budget=groceries, supplier="Tabac")
        _spend(household, owner, "10.00", month="2026-06", budget=groceries, supplier="Tabac")
        _spend(household, owner, "200.00", month="2026-07", budget=groceries, supplier="Leclerc")

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert [s["supplier"] for s in result["suppliers"]] == ["Leclerc", "Tabac"]
        assert result["suppliers"][1]["count"] == 2

    def test_an_expense_without_a_supplier_is_not_a_supplier(self, ctx):
        """Sinon une barre « (vide) » trône en tête et masque les vraies."""
        household, owner, groceries, _ = ctx
        _spend(household, owner, "500.00", month="2026-07", budget=groceries)

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert result["suppliers"] == []

    def test_biggest_expenses_carry_their_budget(self, ctx):
        household, owner, groceries, _ = ctx
        _spend(household, owner, "42.00", month="2026-07", budget=groceries)
        _spend(household, owner, "900.00", month="2026-07", budget=groceries)

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert result["biggest"][0]["amount"] == "900.00"
        assert result["biggest"][0]["budget_name"] == "Courses"


@pytest.mark.django_db
class TestFilteringOnOneBudget:
    def test_everything_narrows_together(self, ctx):
        household, owner, groceries, gifts = ctx
        _spend(household, owner, "300.00", month="2026-07", budget=groceries, supplier="Leclerc")
        _spend(household, owner, "100.00", month="2026-07", budget=gifts, supplier="Fnac")

        result = compute_budget_analysis(
            household=household, months=12, budget_id=str(gifts.id), today=TODAY
        )

        assert [s["name"] for s in result["series"]] == ["Cadeaux"]
        assert result["total"] == "100.00"
        assert [s["supplier"] for s in result["suppliers"]] == ["Fnac"]
        assert len(result["biggest"]) == 1


@pytest.mark.django_db
class TestItStaysCheap:
    def test_the_query_count_does_not_grow_with_the_window(
        self, ctx, django_assert_max_num_queries
    ):
        """Quatre requêtes groupées — jamais une par mois, ni une par budget."""
        household, owner, groceries, gifts = ctx
        for i in range(24):
            month = f"2026-{((i % 12) + 1):02d}"
            _spend(household, owner, "10.00", month=month, budget=groceries if i % 2 else gifts)

        with django_assert_max_num_queries(6):
            compute_budget_analysis(household=household, months=24, today=TODAY)


@pytest.mark.django_db
class TestTheEndpoint:
    def url(self, **params):
        base = reverse("budget-analysis")
        if not params:
            return base
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{base}?{query}"

    def test_it_returns_the_whole_shape(self, ctx):
        household, owner, groceries, _ = ctx
        _spend(household, owner, "120.00", month="2026-07", budget=groceries)

        response = _client_for(owner).get(self.url())

        assert response.status_code == status.HTTP_200_OK
        assert {
            "months", "series", "breakdown", "suppliers", "biggest",
            "total", "monthly_average",
        } <= set(response.data)

    def test_months_is_clamped_not_trusted(self, ctx):
        """``?months=9999`` ne doit pas balayer dix ans d'historique."""
        _, owner, _, _ = ctx

        response = _client_for(owner).get(self.url(months=9999))

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["months"]) == 36

    def test_a_malformed_months_is_a_400(self, ctx):
        _, owner, _, _ = ctx
        assert _client_for(owner).get(self.url(months="nope")).status_code == (
            status.HTTP_400_BAD_REQUEST
        )

    def test_a_malformed_budget_id_is_a_400_not_a_500(self, ctx):
        _, owner, _, _ = ctx
        assert _client_for(owner).get(self.url(budget="not-a-uuid")).status_code == (
            status.HTTP_400_BAD_REQUEST
        )

    def test_another_households_budget_is_refused(self, ctx):
        """Le filtre s'applique après le scope : il ne peut jamais l'élargir."""
        _, owner, _, _ = ctx
        stranger = Budget.objects.create(
            household=HouseholdFactory(), name="Chez eux", monthly_amount=Decimal("100")
        )

        response = _client_for(owner).get(self.url(budget=str(stranger.id)))

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_neighbours_expenses_never_appear(self, ctx):
        household, owner, groceries, _ = ctx
        other = HouseholdFactory(timezone="Europe/Paris")
        other_owner = _make_owner(other)
        _spend(other, other_owner, "9999.00", month="2026-07")

        response = _client_for(owner).get(self.url())

        assert response.data["total"] == "0.00"

    def test_anonymous_is_rejected(self, ctx):
        assert APIClient().get(reverse("budget-analysis")).status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestTheMonthBoundaryFollowsTheHousehold:
    def test_a_late_night_expense_stays_in_its_local_month(self, ctx):
        """31 juillet 23 h à Paris, c'est juillet — pas août en UTC."""
        household, owner, groceries, _ = ctx
        create_manual_expense_interaction(
            household=household,
            user=owner,
            subject="Courses tardives",
            amount=Decimal("60.00"),
            occurred_at=datetime(2026, 7, 31, 23, 30, tzinfo=TZ),
            budget_id=groceries.id,
        )

        result = compute_budget_analysis(
            household=household, months=12, today=date(2026, 7, 31)
        )

        by_month = dict(zip(result["months"], result["series"][0]["values"]))
        assert by_month["2026-07"] == "60.00"


@pytest.mark.django_db
class TestADeletedBudgetLeavesItsSpendingBehind:
    def test_its_expenses_fall_into_the_unbudgeted_bucket(self, ctx):
        """``SET_NULL`` : supprimer une enveloppe n'efface pas ce qu'on a dépensé."""
        household, owner, groceries, _ = ctx
        _spend(household, owner, "75.00", month="2026-07", budget=groceries)
        groceries.delete()

        result = compute_budget_analysis(household=household, months=12, today=TODAY)

        assert [s["name"] for s in result["series"]] == [None]
        assert result["total"] == "75.00"


def test_months_back_is_ordered_oldest_first():
    from budget.analysis import _months_back

    assert _months_back(date(2026, 2, 5), 4) == ["2025-11", "2025-12", "2026-01", "2026-02"]


def test_a_window_never_starts_in_the_future():
    """Régression : ``timedelta`` sur les mois est un piège, on décrémente à la main."""
    from budget.analysis import _months_back

    labels = _months_back(date(2026, 1, 3), 2)
    assert labels == ["2025-12", "2026-01"]
    assert labels[0] < labels[-1]
