# budget/tests/test_insights.py
"""La fiche d'un budget — sa période, son mois d'avant, sa répartition.

La page d'une enveloppe savait dire « 340 € ce mois-ci » et rien de plus. Or ce
chiffre seul ne répond à aucune des trois questions qu'on se pose devant lui :
est-ce beaucoup (par rapport à quand ?), où est-ce parti (chez qui ?), et est-ce
que ça monte (quel jour ?). Ces tests fixent ce que la fiche a le droit de
répondre — et surtout ce qu'elle n'a pas le droit d'inventer : une comparaison
avec une période qui n'a pas la même forme, une part sur un total nul, un « +∞ % »
déguisé en pourcentage.
"""
from __future__ import annotations

import itertools
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.models import (
    BankAccount,
    BankTransaction,
    InflowNature,
    RefundAllocation,
    TransactionDirection,
)
from budget.insights import compute_budget_insights
from budget.models import Budget
from households.models import HouseholdMember
from interactions.aggregations import compute_expense_summary
from interactions.models import Interaction
from interactions.services import create_manual_expense_interaction

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory

TZ = ZoneInfo("Europe/Paris")
_counter = itertools.count()

INSIGHTS_URL = reverse("budget-insights")


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


def _spend(household, user, amount, *, on: date, budget=None, supplier=""):
    return create_manual_expense_interaction(
        household=household,
        user=user,
        subject=f"{supplier or 'Dépense'} {amount}",
        amount=Decimal(str(amount)),
        supplier=supplier,
        occurred_at=datetime(on.year, on.month, on.day, 12, 0, tzinfo=TZ),
        budget_id=budget.id if budget else None,
    )


def _refund(account, *, amount, budget, on: date):
    value = Decimal(str(amount))
    label = "AVOIR"
    txn = BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=on,
        label_raw=label,
        label_norm=label,
        amount=value,
        direction=TransactionDirection.IN,
        inflow_nature=InflowNature.REFUND,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=on,
            label_norm=label,
            amount=value,
            currency="EUR",
            discriminant=f"#{next(_counter)}",
        ),
    )
    RefundAllocation.objects.create(
        household=account.household, transaction=txn, budget=budget, amount=value
    )
    return txn


@pytest.fixture
def ctx(db):
    household = HouseholdFactory(timezone="Europe/Paris")
    owner = _make_owner(household)
    diy = Budget.objects.create(household=household, name="Bricolage", monthly_amount=Decimal("400"))
    return household, owner, diy


#: Par défaut les tests se placent **après** la fenêtre observée : une période
#: close se compare à une période close, ce qui isole les règles de forme du
#: rattrapage « aussi avancée » (testé à part, en fixant `today` dedans).
AFTER = date(2027, 1, 1)


def _insights(household, budget, start, end, today=AFTER):
    return compute_budget_insights(
        household=household,
        budget=str(budget.id) if isinstance(budget, Budget) else budget,
        start=start,
        end=end,
        today=today,
    )


@pytest.mark.django_db
class TestThePreviousPeriodHasTheSameShape:
    """« La période précédente » d'un mois est un mois, pas trente-et-un jours.

    Décaler juillet (31 j) de sa propre durée donnerait le 31 mai → 30 juin :
    un intervalle qui coupe deux mois, chevauche un loyer et en rate un autre.
    La comparaison n'aurait alors aucun sens — et c'est justement la seule
    chose qu'on demande à une comparaison.
    """

    def test_a_full_calendar_month_compares_to_the_previous_month(self, ctx):
        household, owner, diy = ctx

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert result["previous_period"] == {"from": "2026-06-01", "to": "2026-06-30"}

    def test_a_full_calendar_year_compares_to_the_previous_year(self, ctx):
        household, owner, diy = ctx

        result = _insights(household, diy, date(2026, 1, 1), date(2026, 12, 31))

        assert result["previous_period"] == {"from": "2025-01-01", "to": "2025-12-31"}

    def test_a_free_range_compares_to_the_same_duration_just_before(self, ctx):
        """Dix jours se comparent aux dix jours qui les précèdent, sans trou."""
        household, owner, diy = ctx

        result = _insights(household, diy, date(2026, 7, 11), date(2026, 7, 20))

        assert result["previous_period"] == {"from": "2026-07-01", "to": "2026-07-10"}

    def test_the_previous_period_carries_its_own_total(self, ctx):
        household, owner, diy = ctx
        _spend(household, owner, "100.00", on=date(2026, 6, 12), budget=diy)
        _spend(household, owner, "150.00", on=date(2026, 7, 12), budget=diy)

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert result["current"]["net_total"] == "150.00"
        assert result["previous"]["net_total"] == "100.00"
        assert result["delta"]["amount"] == "50.00"
        assert result["delta"]["ratio"] == pytest.approx(0.5)


@pytest.mark.django_db
class TestAPeriodInProgressComparesToTheSameDaysBefore:
    """Le 5 juillet, « ce mois-ci » vaut cinq jours, pas un mois.

    Le comparer aux trente de juin annoncerait « −87 % » à un foyer qui dépense
    exactement comme d'habitude — et ce chiffre serait faux tous les mois, du 1er
    au 30, pour redevenir juste le dernier jour. Un compteur qui ne dit vrai
    qu'une fois par mois ne se lit plus du tout.
    """

    def test_the_previous_window_stops_at_the_same_day(self, ctx):
        household, owner, diy = ctx

        result = _insights(
            household, diy, date(2026, 7, 1), date(2026, 7, 31), today=date(2026, 7, 5)
        )

        assert result["previous_period"] == {"from": "2026-06-01", "to": "2026-06-05"}

    def test_only_the_matching_days_count_in_the_comparison(self, ctx):
        household, owner, diy = ctx
        _spend(household, owner, "100.00", on=date(2026, 6, 3), budget=diy)
        _spend(household, owner, "900.00", on=date(2026, 6, 25), budget=diy)
        _spend(household, owner, "120.00", on=date(2026, 7, 3), budget=diy)

        result = _insights(
            household, diy, date(2026, 7, 1), date(2026, 7, 31), today=date(2026, 7, 5)
        )

        # Les 900 € du 25 juin sont hors des cinq jours écoulés : les compter
        # ferait passer un mois normal pour un effondrement.
        assert result["previous"]["net_total"] == "100.00"
        assert result["delta"]["ratio"] == pytest.approx(0.2)

    def test_the_current_total_still_covers_the_whole_window(self, ctx):
        """On tronque la référence, jamais le compteur : il reste celui du panneau."""
        household, owner, diy = ctx
        _spend(household, owner, "120.00", on=date(2026, 7, 3), budget=diy)

        result = _insights(
            household, diy, date(2026, 7, 1), date(2026, 7, 31), today=date(2026, 7, 5)
        )

        assert result["period"] == {"from": "2026-07-01", "to": "2026-07-31"}
        assert result["current"]["net_total"] == "120.00"

    def test_a_finished_month_compares_to_the_whole_month_before(self, ctx):
        household, owner, diy = ctx

        result = _insights(
            household, diy, date(2026, 7, 1), date(2026, 7, 31), today=date(2026, 8, 2)
        )

        assert result["previous_period"] == {"from": "2026-06-01", "to": "2026-06-30"}

    def test_a_year_in_progress_compares_to_as_much_of_the_year_before(self, ctx):
        household, owner, diy = ctx

        result = _insights(
            household, diy, date(2026, 1, 1), date(2026, 12, 31), today=date(2026, 3, 10)
        )

        assert result["previous_period"] == {"from": "2025-01-01", "to": "2025-03-10"}


@pytest.mark.django_db
class TestTheDeltaNeverInventsAComparison:
    def test_no_ratio_when_the_previous_period_spent_nothing(self, ctx):
        """Passer de 0 € à 150 € n'est pas « +∞ % » : c'est un premier mois.

        Un pourcentage sur un dénominateur nul est le même mensonge qu'une part
        sur un total nul — le front doit pouvoir dire « pas de comparaison »,
        donc il lui faut ``null``, pas un nombre choisi à sa place.
        """
        household, owner, diy = ctx
        _spend(household, owner, "150.00", on=date(2026, 7, 12), budget=diy)

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert result["previous"]["net_total"] == "0.00"
        assert result["delta"]["ratio"] is None
        assert result["delta"]["amount"] == "150.00"

    def test_a_drop_is_a_negative_delta(self, ctx):
        household, owner, diy = ctx
        _spend(household, owner, "200.00", on=date(2026, 6, 12), budget=diy)
        _spend(household, owner, "50.00", on=date(2026, 7, 12), budget=diy)

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert result["delta"]["amount"] == "-150.00"
        assert result["delta"]["ratio"] == pytest.approx(-0.75)


@pytest.mark.django_db
class TestTheTrendCoversTheChosenPeriod:
    def test_a_short_window_is_read_day_by_day(self, ctx):
        """Un mois en une seule barre mensuelle n'est pas une tendance."""
        household, owner, diy = ctx
        _spend(household, owner, "20.00", on=date(2026, 7, 3), budget=diy)
        _spend(household, owner, "30.00", on=date(2026, 7, 3), budget=diy)
        _spend(household, owner, "10.00", on=date(2026, 7, 5), budget=diy)

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert result["granularity"] == "day"
        by_label = {b["label"]: b["total"] for b in result["buckets"]}
        assert by_label["2026-07-03"] == "50.00"
        assert by_label["2026-07-05"] == "10.00"

    def test_empty_buckets_are_present_and_zero(self, ctx):
        """Un jour sans dépense est une information ; le trouer déforme l'axe."""
        household, owner, diy = ctx
        _spend(household, owner, "20.00", on=date(2026, 7, 3), budget=diy)

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert len(result["buckets"]) == 31
        assert result["buckets"][0] == {"label": "2026-07-01", "total": "0.00"}
        assert result["buckets"][-1]["label"] == "2026-07-31"

    def test_a_long_window_falls_back_to_months(self, ctx):
        household, owner, diy = ctx
        _spend(household, owner, "40.00", on=date(2026, 3, 9), budget=diy)

        result = _insights(household, diy, date(2026, 1, 1), date(2026, 12, 31))

        assert result["granularity"] == "month"
        assert len(result["buckets"]) == 12
        by_label = {b["label"]: b["total"] for b in result["buckets"]}
        assert by_label["2026-03"] == "40.00"
        assert by_label["2026-04"] == "0.00"

    def test_the_buckets_recompose_the_gross_total(self, ctx):
        """Le graphique décompose ``total``, le brut — pas le net.

        Un remboursement est daté par la banque, pas par la dépense : le
        retrancher d'un jour du graphique daterait le rendu au jour de l'achat.
        """
        household, owner, diy = ctx
        _spend(household, owner, "60.00", on=date(2026, 7, 3), budget=diy)
        _spend(household, owner, "40.00", on=date(2026, 7, 9), budget=diy)

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert sum(Decimal(b["total"]) for b in result["buckets"]) == Decimal("100.00")
        assert result["current"]["total"] == "100.00"


@pytest.mark.django_db
class TestTheShareBySupplier:
    def test_shares_add_up_to_one(self, ctx):
        household, owner, diy = ctx
        _spend(household, owner, "75.00", on=date(2026, 7, 3), budget=diy, supplier="Leroy Merlin")
        _spend(household, owner, "25.00", on=date(2026, 7, 4), budget=diy, supplier="Castorama")

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert [s["supplier"] for s in result["suppliers"]] == ["Leroy Merlin", "Castorama"]
        assert result["suppliers"][0]["share"] == pytest.approx(0.75)
        assert sum(s["share"] for s in result["suppliers"]) == pytest.approx(1.0)

    def test_expenses_without_a_supplier_stay_in_the_breakdown(self, ctx):
        """Les écarter ferait un anneau qui ne fait plus 100 %.

        Le classement des fournisseurs de la page Analyse peut exclure les
        dépenses sans fournisseur : c'est un palmarès. Une **répartition** ne le
        peut pas — la part manquante n'irait nulle part et l'anneau mentirait.
        """
        household, owner, diy = ctx
        _spend(household, owner, "60.00", on=date(2026, 7, 3), budget=diy, supplier="Leroy Merlin")
        _spend(household, owner, "40.00", on=date(2026, 7, 4), budget=diy)

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert {s["supplier"] for s in result["suppliers"]} == {"Leroy Merlin", ""}
        assert sum(s["share"] for s in result["suppliers"]) == pytest.approx(1.0)

    def test_no_spending_means_no_breakdown_at_all(self, ctx):
        """Sans dépense il n'y a pas de répartition — pas une répartition à 0 %."""
        household, owner, diy = ctx

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert result["suppliers"] == []
        assert result["current"]["total"] == "0.00"


@pytest.mark.django_db
class TestTheFilterOptions:
    """Ce sur quoi la fiche propose de filtrer sa liste, et d'où ça vient.

    Les options viennent de la **fenêtre entière**, jamais des lignes de la page
    affichée : une pastille qui apparaît en tournant les pages ferait douter de
    ce qu'on filtre, et sur une enveloppe de trois cents dépenses la page 1 ne
    connaît qu'un cinquième des natures.
    """

    def test_the_kinds_of_the_window_are_listed_heaviest_first(self, ctx):
        household, owner, diy = ctx
        light = _spend(household, owner, "10.00", on=date(2026, 7, 3), budget=diy)
        heavy = _spend(household, owner, "90.00", on=date(2026, 7, 4), budget=diy)
        Interaction.objects.filter(pk=light.pk).update(kind="stock_purchase")
        Interaction.objects.filter(pk=heavy.pk).update(kind="bank")

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert [k["kind"] for k in result["kinds"]] == ["bank", "stock_purchase"]
        assert result["kinds"][0]["total"] == "90.00"
        assert result["kinds"][0]["count"] == 1

    def test_a_kind_outside_the_window_is_not_an_option(self, ctx):
        """Filtrer sur une nature qui ne rendrait aucune ligne n'aide personne."""
        household, owner, diy = ctx
        june = _spend(household, owner, "50.00", on=date(2026, 6, 15), budget=diy)
        Interaction.objects.filter(pk=june.pk).update(kind="stock_purchase")
        _spend(household, owner, "20.00", on=date(2026, 7, 4), budget=diy)

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert [k["kind"] for k in result["kinds"]] == ["manual"]

    def test_an_empty_kind_never_becomes_a_pill(self, ctx):
        """Une pastille sans libellé n'est pas un filtre, c'est un bouton muet."""
        household, owner, diy = ctx
        blank = _spend(household, owner, "30.00", on=date(2026, 7, 3), budget=diy)
        Interaction.objects.filter(pk=blank.pk).update(kind="")

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))

        assert result["kinds"] == []
        # La dépense reste comptée : elle n'est pas filtrable, elle n'est pas
        # invisible.
        assert result["current"]["total"] == "30.00"


@pytest.mark.django_db
class TestTheHeadlineFigureAgreesWithTheSummaryCard:
    """La fiche et son propre compteur ne peuvent pas diverger.

    ``compute_expense_summary`` est déjà la définition du « dépensé » d'une
    enveloppe sur une période — la carte du haut de la page la lit. Recalculer
    la même chose ici donnerait au compteur une seconde définition, et c'est
    exactement la faute que le module argent passe son temps à réparer.
    """

    def test_the_current_totals_are_the_summary_totals(self, ctx):
        household, owner, diy = ctx
        account = BankAccount.objects.create(
            household=household, name="Courant", kind=BankAccount.Kind.BANK
        )
        _spend(household, owner, "150.00", on=date(2026, 7, 3), budget=diy)
        _refund(account, amount="40.00", budget=diy, on=date(2026, 7, 20))

        result = _insights(household, diy, date(2026, 7, 1), date(2026, 7, 31))
        summary = compute_expense_summary(
            household_id=household.id,
            from_dt=datetime(2026, 7, 1, 0, 0, tzinfo=TZ),
            to_dt=datetime(2026, 7, 31, 23, 59, 59, 999999, tzinfo=TZ),
            budget=str(diy.id),
        )

        assert result["current"]["total"] == summary["total"] == "150.00"
        assert result["current"]["refunded"] == summary["refunded"] == "40.00"
        assert result["current"]["net_total"] == summary["net_total"] == "110.00"
        assert result["current"]["count"] == summary["count"] == 1


@pytest.mark.django_db
class TestTheUnbudgetedBucket:
    def test_none_reads_the_expenses_attached_to_no_envelope(self, ctx):
        """« Hors budget » s'ouvre comme une enveloppe — même page, même geste."""
        household, owner, diy = ctx
        _spend(household, owner, "80.00", on=date(2026, 7, 3), budget=diy)
        _spend(household, owner, "20.00", on=date(2026, 7, 4))

        result = _insights(household, "none", date(2026, 7, 1), date(2026, 7, 31))

        assert result["current"]["total"] == "20.00"


@pytest.mark.django_db
class TestTheEndpoint:
    def test_it_returns_the_insights_of_the_requested_window(self, ctx):
        household, owner, diy = ctx
        _spend(household, owner, "150.00", on=date(2026, 7, 12), budget=diy)
        client = _client_for(owner)

        response = client.get(
            INSIGHTS_URL, {"budget": str(diy.id), "from": "2026-07-01", "to": "2026-07-31"}
        )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["current"]["net_total"] == "150.00"
        assert body["period"] == {"from": "2026-07-01", "to": "2026-07-31"}

    def test_another_households_expenses_never_leak_in(self, ctx):
        household, owner, diy = ctx
        other = HouseholdFactory(timezone="Europe/Paris")
        other_owner = _make_owner(other)
        other_budget = Budget.objects.create(household=other, name="Bricolage", monthly_amount=None)
        _spend(other, other_owner, "999.00", on=date(2026, 7, 12), budget=other_budget)
        client = _client_for(owner)

        response = client.get(
            INSIGHTS_URL,
            {"budget": str(other_budget.id), "from": "2026-07-01", "to": "2026-07-31"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_malformed_budget_id_is_a_400_not_a_500(self, ctx):
        household, owner, diy = ctx
        client = _client_for(owner)

        response = client.get(
            INSIGHTS_URL, {"budget": "pas-un-uuid", "from": "2026-07-01", "to": "2026-07-31"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_malformed_date_is_a_400(self, ctx):
        household, owner, diy = ctx
        client = _client_for(owner)

        response = client.get(INSIGHTS_URL, {"from": "hier", "to": "2026-07-31"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_it_defaults_to_the_current_month_of_the_household(self, ctx):
        """Ouvrir la fiche sans période, c'est ouvrir le compteur du panneau."""
        household, owner, diy = ctx
        client = _client_for(owner)

        response = client.get(INSIGHTS_URL, {"budget": str(diy.id)})

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        today = datetime.now(TZ).date()
        assert body["period"]["from"] == f"{today.year:04d}-{today.month:02d}-01"
