# budget/tests/test_groups.py
"""Des catégories de catégories — « Maison » au-dessus de « Bricolage ».

Le choix de conception tient en une phrase, et ces tests existent pour qu'elle
reste vraie : **un groupe est un sous-total, jamais une case.** Un euro se range
toujours sur une feuille.

C'est ce qui permet d'ajouter la hiérarchie sans toucher à une seule des neuf
agrégations de montants : `spent` garde exactement sa définition, les bilans
mensuels déjà figés restent lisibles, et « dépensé » ne prend jamais les deux
sens (propre / consolidé) qu'il aurait fallu distinguer partout et pour toujours.
"""
from __future__ import annotations

import itertools
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from django.utils import timezone

from accounts.models import User
from budget.aggregations import compute_budget_overview
from budget.models import Budget
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from interactions.services import _resolve_expense_budget

_counter = itertools.count()
BUDGETS_URL = "/api/budget/budgets/"


def make_household_user():
    household = Household.objects.create(name=f"Groups {next(_counter)}")
    user = User.objects.create_user(email=f"g-{next(_counter)}@example.com", password="pass1234")
    HouseholdMember.objects.create(
        household=household, user=user, role=HouseholdMember.Role.MEMBER
    )
    user.active_household = household
    user.save(update_fields=["active_household"])
    return household, user


def make_budget(household, name, amount=None, *, parent=None, is_global=False):
    return Budget.objects.create(
        household=household,
        name=name,
        monthly_amount=None if amount is None else Decimal(amount),
        parent=parent,
        is_global=is_global,
    )


def spend(household, user, budget, amount):
    return Interaction.objects.create(
        household=household,
        created_by=user,
        subject=f"Achat {amount}",
        type="expense",
        amount=Decimal(amount),
        kind="manual",
        budget=budget,
        occurred_at=timezone.now(),
    )


@pytest.fixture
def context(db):
    household, user = make_household_user()
    client = APIClient()
    client.force_authenticate(user=user)
    return {"household": household, "user": user, "client": client}


class TestAGroupIsASubtotal:
    def test_a_parent_shows_what_its_children_spent(self, context):
        house = make_budget(context["household"], "Maison", "500")
        diy = make_budget(context["household"], "Bricolage", "200", parent=house)
        energy = make_budget(context["household"], "Énergie", "250", parent=house)
        spend(context["household"], context["user"], diy, "120")
        spend(context["household"], context["user"], energy, "220")

        rows = {r["name"]: r for r in compute_budget_overview(household=context["household"])["budgets"]}

        assert rows["Maison"]["spent"] == "340.00"
        assert rows["Maison"]["is_group"] is True
        assert rows["Bricolage"]["spent"] == "120.00"
        assert rows["Bricolage"]["parent_id"] == str(house.id)
        assert rows["Bricolage"]["is_group"] is False

    def test_the_parent_state_is_measured_on_the_rollup(self, context):
        """420 € sur 500 € : le groupe est en alerte, aucun de ses enfants ne l'est."""
        house = make_budget(context["household"], "Maison", "500")
        diy = make_budget(context["household"], "Bricolage", "1000", parent=house)
        spend(context["household"], context["user"], diy, "420")

        rows = {r["name"]: r for r in compute_budget_overview(household=context["household"])["budgets"]}

        assert rows["Maison"]["state"] == "warning"
        assert rows["Bricolage"]["state"] == "ok"

    def test_an_uncapped_group_still_totals_its_children(self, context):
        house = make_budget(context["household"], "Maison")
        diy = make_budget(context["household"], "Bricolage", "200", parent=house)
        spend(context["household"], context["user"], diy, "75")

        rows = {r["name"]: r for r in compute_budget_overview(household=context["household"])["budgets"]}

        assert rows["Maison"]["spent"] == "75.00"
        assert rows["Maison"]["amount"] is None
        assert rows["Maison"]["state"] == "uncapped"


class TestTheGlobalCeilingIsNotCountedTwice:
    """⚠️ Le piège le plus coûteux de la hiérarchie, et il est silencieux.

    Additionner le plafond d'un groupe **et** ceux de ses enfants doublerait
    l'engagement du foyer, et ferait crier « les enveloppes dépassent le plafond
    global » à quelqu'un de parfaitement cohérent. Un groupe plafonné remplace ses
    enfants ; un groupe sans plafond vaut leur somme.
    """

    def test_a_capped_group_replaces_its_children(self, context):
        make_budget(context["household"], "Global", "1000", is_global=True)
        house = make_budget(context["household"], "Maison", "500")
        make_budget(context["household"], "Bricolage", "200", parent=house)
        make_budget(context["household"], "Énergie", "250", parent=house)

        overview = compute_budget_overview(household=context["household"])

        assert overview["named_total_amount"] == "500.00"
        assert overview["named_exceeds_global"] is False

    def test_an_uncapped_group_is_worth_its_children(self, context):
        make_budget(context["household"], "Global", "1000", is_global=True)
        house = make_budget(context["household"], "Maison")
        make_budget(context["household"], "Bricolage", "200", parent=house)
        make_budget(context["household"], "Énergie", "250", parent=house)

        overview = compute_budget_overview(household=context["household"])

        assert overview["named_total_amount"] == "450.00"

    def test_the_overshoot_is_still_reported_when_it_is_real(self, context):
        make_budget(context["household"], "Global", "400", is_global=True)
        house = make_budget(context["household"], "Maison", "500")
        make_budget(context["household"], "Bricolage", "200", parent=house)

        overview = compute_budget_overview(household=context["household"])

        assert overview["named_exceeds_global"] is True


class TestOneEuroOneLeaf:
    """Un groupe n'est jamais une cible — la règle qui protège les neuf sommes."""

    def test_the_resolver_refuses_a_group(self, context):
        house = make_budget(context["household"], "Maison")
        make_budget(context["household"], "Bricolage", parent=house)

        with pytest.raises(ValueError, match="group"):
            _resolve_expense_budget(context["household"].id, house.id)

    def test_a_leaf_is_accepted(self, context):
        house = make_budget(context["household"], "Maison")
        diy = make_budget(context["household"], "Bricolage", parent=house)

        assert _resolve_expense_budget(context["household"].id, diy.id) == diy

    def test_a_budget_that_carries_money_cannot_become_a_group(self, context):
        """Sinon ses dépenses deviendraient le « propre » d'un parent.

        C'est exactement l'ambiguïté que le choix de conception refuse : le
        serveur dit non, et dit combien de dépenses bloquent.
        """
        house = make_budget(context["household"], "Maison")
        spend(context["household"], context["user"], house, "42")
        orphan = make_budget(context["household"], "Bricolage")

        response = context["client"].patch(
            f"{BUDGETS_URL}{orphan.id}/", {"parent_id": str(house.id)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "1 expense" in str(response.data["parent_id"])


class TestTheShapeOfTheTree:
    def test_groups_are_two_levels_deep(self, context):
        house = make_budget(context["household"], "Maison")
        diy = make_budget(context["household"], "Bricolage", parent=house)
        tools = make_budget(context["household"], "Outillage")

        response = context["client"].patch(
            f"{BUDGETS_URL}{tools.id}/", {"parent_id": str(diy.id)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_group_cannot_be_nested(self, context):
        house = make_budget(context["household"], "Maison")
        make_budget(context["household"], "Bricolage", parent=house)
        other = make_budget(context["household"], "Courses")

        response = context["client"].patch(
            f"{BUDGETS_URL}{house.id}/", {"parent_id": str(other.id)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_budget_cannot_be_its_own_group(self, context):
        solo = make_budget(context["household"], "Maison")

        response = context["client"].patch(
            f"{BUDGETS_URL}{solo.id}/", {"parent_id": str(solo.id)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_the_global_budget_belongs_to_no_group(self, context):
        overall = make_budget(context["household"], "Global", "1000", is_global=True)
        house = make_budget(context["household"], "Maison")

        response = context["client"].patch(
            f"{BUDGETS_URL}{overall.id}/", {"parent_id": str(house.id)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_the_global_budget_cannot_be_a_group(self, context):
        overall = make_budget(context["household"], "Global", "1000", is_global=True)
        house = make_budget(context["household"], "Maison")

        response = context["client"].patch(
            f"{BUDGETS_URL}{house.id}/", {"parent_id": str(overall.id)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_budget_from_another_household_is_not_a_group(self, context):
        other_household, _ = make_household_user()
        stranger = make_budget(other_household, "Chez le voisin")
        mine = make_budget(context["household"], "Maison")

        response = context["client"].patch(
            f"{BUDGETS_URL}{mine.id}/", {"parent_id": str(stranger.id)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestDeletingAGroupFreesItsChildren:
    """`SET_NULL` : supprimer un intitulé ne doit pas emporter l'argent."""

    def test_children_survive_as_roots(self, context):
        house = make_budget(context["household"], "Maison")
        diy = make_budget(context["household"], "Bricolage", "200", parent=house)
        spend(context["household"], context["user"], diy, "120")

        context["client"].delete(f"{BUDGETS_URL}{house.id}/")

        diy.refresh_from_db()
        assert diy.parent_id is None
        rows = {r["name"]: r for r in compute_budget_overview(household=context["household"])["budgets"]}
        assert rows["Bricolage"]["spent"] == "120.00"
