# budget/tests/test_category_insights.py
"""La fiche d'une catégorie — où part le total de ses enveloppes.

Le panneau Budgets affiche « 340 € / 450 € » sur une catégorie et s'arrête là.
La question qui suit n'est pas la même que sur une enveloppe : ce n'est pas
*chez qui* l'argent est parti, c'est **laquelle de mes enveloppes** mange ce
total. Un anneau par budget est la seule lecture qui y répond d'un coup d'œil.

Ce que ces tests tiennent, et qui n'a rien de cosmétique :

- une catégorie ne porte aucune dépense, donc son total ne peut être qu'une
  **lecture des dépenses de ses enveloppes** — jamais un compteur de plus ;
- ce total doit être au centime celui que le panneau affiche déjà, sinon cliquer
  sur un chiffre ouvre une page qui le contredit ;
- la répartition se fait sur le **brut**, comme celle par fournisseur : c'est ce
  que les parts recomposent.
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
from budget.aggregations import compute_budget_overview
from budget.insights import compute_budget_insights
from budget.models import Budget, BudgetCategory
from core.timezones import household_today
from households.models import HouseholdMember
from interactions.services import create_manual_expense_interaction

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory

TZ = ZoneInfo("Europe/Paris")
_counter = itertools.count()

INSIGHTS_URL = reverse("budget-insights")

#: Les tests de forme se placent **après** la fenêtre observée : une période
#: close se compare à une période close.
AFTER = date(2027, 1, 1)


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
    """Une catégorie « Maison » qui range deux enveloppes, plus une enveloppe libre."""
    household = HouseholdFactory(timezone="Europe/Paris")
    owner = _make_owner(household)
    home = BudgetCategory.objects.create(household=household, name="Maison", monthly_amount=None)
    diy = Budget.objects.create(
        household=household, name="Bricolage", monthly_amount=Decimal("400"), category=home
    )
    energy = Budget.objects.create(
        household=household, name="Énergie", monthly_amount=None, category=home
    )
    loose = Budget.objects.create(household=household, name="Loisirs", monthly_amount=None)
    return household, owner, home, diy, energy, loose


def _category_insights(household, category, start, end, today=AFTER):
    return compute_budget_insights(
        household=household,
        budget=None,
        category=str(category.id),
        start=start,
        end=end,
        today=today,
    )


@pytest.mark.django_db
class TestTheShareByEnvelope:
    """L'anneau de la fiche : quelle enveloppe mange le total, et pour quelle part."""

    def test_shares_add_up_to_one_biggest_first(self, ctx):
        household, owner, home, diy, energy, _loose = ctx
        _spend(household, owner, "75.00", on=date(2026, 7, 3), budget=diy)
        _spend(household, owner, "25.00", on=date(2026, 7, 4), budget=energy)

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        assert [b["name"] for b in result["budgets"]] == ["Bricolage", "Énergie"]
        assert result["budgets"][0]["budget_id"] == str(diy.id)
        assert result["budgets"][0]["total"] == "75.00"
        assert result["budgets"][0]["share"] == pytest.approx(0.75)
        assert sum(b["share"] for b in result["budgets"]) == pytest.approx(1.0)


@pytest.mark.django_db
class TestAPartIsWhatTheEnvelopeReallyCost:
    """⚠️ Une part se mesure sur le **net**, jamais sur le brut.

    Une enveloppe remboursée de 488 € sur 762 € dépensés a coûté 275 € au foyer.
    La dessiner à 762 € la fait paraître trois fois plus lourde qu'elle n'est, et
    l'anneau annonce alors un « total période » que la carte juste au-dessus — le
    net — contredit. Deux totaux sous les mêmes mots.

    Rien à voir avec la courbe, qui reste sur le brut : là, déduire un
    remboursement le daterait au jour de l'achat alors que la banque l'a passé un
    autre jour. Une **part** n'a pas de date — le problème ne se pose pas.
    """

    def test_a_slice_is_net_of_what_came_back(self, ctx):
        household, owner, home, diy, energy, _loose = ctx
        account = BankAccount.objects.create(
            household=household, name="Courant", kind=BankAccount.Kind.BANK
        )
        _spend(household, owner, "300.00", on=date(2026, 7, 3), budget=diy)
        _refund(account, amount="200.00", budget=diy, on=date(2026, 7, 20))
        _spend(household, owner, "100.00", on=date(2026, 7, 4), budget=energy)

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        rows = {b["name"]: b for b in result["budgets"]}
        assert rows["Bricolage"]["total"] == "300.00"
        assert rows["Bricolage"]["refunded"] == "200.00"
        assert rows["Bricolage"]["net_total"] == "100.00"
        # Deux enveloppes à 100 € net : moitié-moitié, alors que le brut aurait
        # donné 75 % / 25 %.
        assert rows["Bricolage"]["share"] == pytest.approx(0.5)
        assert rows["Énergie"]["share"] == pytest.approx(0.5)

    def test_the_ring_total_is_the_headline_total(self, ctx):
        """Ce que l'anneau décompose est le chiffre écrit juste au-dessus de lui."""
        household, owner, home, diy, energy, _loose = ctx
        account = BankAccount.objects.create(
            household=household, name="Courant", kind=BankAccount.Kind.BANK
        )
        _spend(household, owner, "300.00", on=date(2026, 7, 3), budget=diy)
        _refund(account, amount="200.00", budget=diy, on=date(2026, 7, 20))
        _spend(household, owner, "100.00", on=date(2026, 7, 4), budget=energy)

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        assert result["budgets_net_total"] == result["current"]["net_total"] == "200.00"

    def test_a_refund_on_the_last_day_of_the_window_still_counts(self, ctx):
        """⚠️ La borne de fin est **inclusive**.

        L'aperçu du panneau passe le 1er du mois suivant à son propre calcul de
        remboursements ; la fiche passe une fin inclusive. Emprunter la borne de
        l'un à l'autre perdrait sans un mot tout remboursement daté du dernier
        jour — le 31, jour où tombent les régularisations.
        """
        household, owner, home, diy, _energy, _loose = ctx
        account = BankAccount.objects.create(
            household=household, name="Courant", kind=BankAccount.Kind.BANK
        )
        _spend(household, owner, "300.00", on=date(2026, 7, 3), budget=diy)
        _refund(account, amount="50.00", budget=diy, on=date(2026, 7, 31))

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        assert result["budgets"][0]["refunded"] == "50.00"
        assert result["budgets"][0]["net_total"] == "250.00"


@pytest.mark.django_db
class TestAnEnvelopeGivenBackMoreThanItSpent:
    """Un mois peut rendre plus qu'il n'a dépensé — et ça ne se dessine pas.

    Un remboursement compte dans **son** mois, jamais dans celui de l'achat :
    dépenser en juin et se faire rembourser en juillet est le cas normal, pas une
    anomalie. Sur juillet, l'enveloppe est donc net négative — et un camembert ne
    sait pas dessiner une part négative.

    Elle sort de l'anneau, mais **elle ne disparaît pas** : l'omettre en silence
    ferait croire qu'aucun argent n'est revenu. Elle est nommée à part, avec son
    montant, et c'est ce qui explique l'écart entre ce que l'anneau décompose et
    le total de la carte du haut.
    """

    def test_it_leaves_the_ring_but_is_named_apart(self, ctx):
        household, owner, home, diy, energy, _loose = ctx
        account = BankAccount.objects.create(
            household=household, name="Courant", kind=BankAccount.Kind.BANK
        )
        _spend(household, owner, "100.00", on=date(2026, 7, 3), budget=diy)
        # Énergie : rien dépensé en juillet, 40 € rendus sur un achat de juin.
        _refund(account, amount="40.00", budget=energy, on=date(2026, 7, 20))

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        assert [b["name"] for b in result["budgets"]] == ["Bricolage"]
        assert [b["name"] for b in result["budgets_returned"]] == ["Énergie"]
        returned = result["budgets_returned"][0]
        assert returned["total"] == "0.00"
        assert returned["refunded"] == "40.00"
        assert returned["net_total"] == "-40.00"

    def test_the_gap_with_the_headline_is_exactly_what_came_back(self, ctx):
        """L'écart se recompose : sans ça il ressemblerait à une erreur de calcul."""
        household, owner, home, diy, energy, _loose = ctx
        account = BankAccount.objects.create(
            household=household, name="Courant", kind=BankAccount.Kind.BANK
        )
        _spend(household, owner, "100.00", on=date(2026, 7, 3), budget=diy)
        _refund(account, amount="40.00", budget=energy, on=date(2026, 7, 20))

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        ring = Decimal(result["budgets_net_total"])
        apart = sum(Decimal(b["net_total"]) for b in result["budgets_returned"])
        assert ring == Decimal("100.00")
        assert ring + apart == Decimal(result["current"]["net_total"]) == Decimal("60.00")

    def test_an_envelope_at_exactly_zero_net_is_not_a_slice(self, ctx):
        """Tout rendu : rien à dessiner, mais le rendu se dit quand même."""
        household, owner, home, diy, _energy, _loose = ctx
        account = BankAccount.objects.create(
            household=household, name="Courant", kind=BankAccount.Kind.BANK
        )
        _spend(household, owner, "80.00", on=date(2026, 7, 3), budget=diy)
        _refund(account, amount="80.00", budget=diy, on=date(2026, 7, 20))

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        assert result["budgets"] == []
        assert [b["name"] for b in result["budgets_returned"]] == ["Bricolage"]
        assert result["budgets_net_total"] == "0.00"

    def test_an_envelope_of_another_category_never_enters_the_ring(self, ctx):
        """Sinon l'anneau ferait plus que cent, et le total au-dessus mentirait."""
        household, owner, home, diy, _energy, loose = ctx
        _spend(household, owner, "60.00", on=date(2026, 7, 3), budget=diy)
        _spend(household, owner, "999.00", on=date(2026, 7, 4), budget=loose)
        _spend(household, owner, "40.00", on=date(2026, 7, 5))

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        assert [b["name"] for b in result["budgets"]] == ["Bricolage"]
        assert result["current"]["total"] == "60.00"

    def test_an_envelope_without_spending_is_absent_not_a_zero_slice(self, ctx):
        """Une part à 0 % est un filet illisible qui prend une couleur pour rien."""
        household, owner, home, diy, _energy, _loose = ctx
        _spend(household, owner, "60.00", on=date(2026, 7, 3), budget=diy)

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        assert [b["name"] for b in result["budgets"]] == ["Bricolage"]

    def test_no_spending_means_no_breakdown_at_all(self, ctx):
        household, owner, home, _diy, _energy, _loose = ctx

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        assert result["budgets"] == []
        assert result["current"]["total"] == "0.00"

    def test_an_envelope_scope_has_no_ring_by_envelope(self, ctx):
        """La fiche d'une enveloppe ne se répartit pas entre elle-même."""
        household, owner, _home, diy, _energy, _loose = ctx
        _spend(household, owner, "60.00", on=date(2026, 7, 3), budget=diy)

        result = compute_budget_insights(
            household=household,
            budget=str(diy.id),
            start=date(2026, 7, 1),
            end=date(2026, 7, 31),
            today=AFTER,
        )

        assert result["budgets"] == []


@pytest.mark.django_db
class TestTheCategoryTotalAgreesWithThePanel:
    """⚠️ Régression — cliquer sur un chiffre ne peut pas ouvrir son démenti.

    ``BudgetCategoryViewSet`` ne porte aucune agrégation, précisément pour que
    « dépensé » garde une seule définition : le sous-total d'une catégorie est
    calculé une fois, dans l'aperçu, à côté des enveloppes qu'elle range. La
    fiche lit donc les **mêmes dépenses** par un filtre de scope, jamais un
    second compteur — deux sommes indépendantes finissent toujours par diverger,
    et aucune des deux ne dit alors laquelle se trompe.
    """

    def test_the_headline_is_the_category_row_of_the_overview(self, ctx):
        household, owner, home, diy, energy, loose = ctx
        today = household_today(household)
        first = today.replace(day=1)
        account = BankAccount.objects.create(
            household=household, name="Courant", kind=BankAccount.Kind.BANK
        )
        _spend(household, owner, "150.00", on=first, budget=diy)
        _spend(household, owner, "80.50", on=today, budget=energy)
        _spend(household, owner, "999.00", on=today, budget=loose)
        _refund(account, amount="40.00", budget=diy, on=today)

        overview = compute_budget_overview(household=household)
        row = next(c for c in overview["categories"] if c["id"] == str(home.id))
        result = _category_insights(household, home, first, today, today=today)

        assert result["current"]["total"] == row["spent"] == "230.50"
        assert result["current"]["refunded"] == row["refunded"] == "40.00"
        assert result["current"]["net_total"] == row["net_spent"] == "190.50"

    def test_a_refund_on_a_sibling_envelope_never_credits_the_category_twice(self, ctx):
        """Le remboursement est cadré par le même scope que les dépenses."""
        household, owner, home, diy, _energy, loose = ctx
        account = BankAccount.objects.create(
            household=household, name="Courant", kind=BankAccount.Kind.BANK
        )
        _spend(household, owner, "100.00", on=date(2026, 7, 3), budget=diy)
        _refund(account, amount="30.00", budget=loose, on=date(2026, 7, 20))

        result = _category_insights(household, home, date(2026, 7, 1), date(2026, 7, 31))

        assert result["current"]["refunded"] == "0.00"
        assert result["current"]["net_total"] == "100.00"


@pytest.mark.django_db
class TestTheEndpoint:
    def test_it_answers_on_a_category(self, ctx):
        household, owner, home, diy, energy, _loose = ctx
        _spend(household, owner, "150.00", on=date(2026, 7, 12), budget=diy)
        _spend(household, owner, "50.00", on=date(2026, 7, 13), budget=energy)
        client = _client_for(owner)

        response = client.get(
            INSIGHTS_URL,
            {"category": str(home.id), "from": "2026-07-01", "to": "2026-07-31"},
        )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["current"]["net_total"] == "200.00"
        assert [b["name"] for b in body["budgets"]] == ["Bricolage", "Énergie"]

    def test_another_households_category_is_refused(self, ctx):
        household, owner, _home, _diy, _energy, _loose = ctx
        other = HouseholdFactory(timezone="Europe/Paris")
        other_owner = _make_owner(other)
        other_category = BudgetCategory.objects.create(household=other, name="Maison")
        other_budget = Budget.objects.create(
            household=other, name="Bricolage", monthly_amount=None, category=other_category
        )
        _spend(other, other_owner, "999.00", on=date(2026, 7, 12), budget=other_budget)
        client = _client_for(owner)

        response = client.get(INSIGHTS_URL, {"category": str(other_category.id)})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_malformed_category_id_is_a_400_not_a_500(self, ctx):
        household, owner, _home, _diy, _energy, _loose = ctx
        client = _client_for(owner)

        response = client.get(INSIGHTS_URL, {"category": "pas-un-uuid"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_asking_for_both_scopes_at_once_is_refused(self, ctx):
        """Un budget **et** sa catégorie n'est pas une fenêtre : c'est une ambiguïté.

        En choisir un en silence donnerait un total juste sous un titre faux.
        """
        household, owner, home, diy, _energy, _loose = ctx
        client = _client_for(owner)

        response = client.get(
            INSIGHTS_URL, {"budget": str(diy.id), "category": str(home.id)}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
